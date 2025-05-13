import { groupBy } from 'lodash'
import { Op } from 'sequelize'
import { Publisher, startPublisher } from './common/amqp'
import { FINAL_QUEUE_NAME, FIRST_QUEUE_NAME } from './common/constants'
import { RateLimiter } from './common/rate-limiter'
import { Match, Odd } from './db'
import { getSurebets } from './surebet'

let publisher: Publisher

/**
 * 第一次盘口抓取主进程
 */
async function run() {
    //从surebet读取数据
    const surebetRecords = await getSurebets()
    console.log('满足条件的surebet数据', surebetRecords.length)
    if (surebetRecords.length === 0) return

    //对盘口进行筛选，如果这个盘口是已经通过了一次对比的就不要了
    const filtredRecords: Surebet.Output[] = []
    for (const record of surebetRecords) {
        const exists = await Odd.findOne({
            where: {
                crown_match_id: record.crown_match_id,
                variety: record.type.variety,
                period: record.type.period,
                type: record.type.type,
                condition: record.type.condition,
                status: {
                    [Op.ne]: '',
                },
            },
            attributes: ['id'],
        })
        if (exists) {
            continue
        }
        filtredRecords.push(record)
    }

    //根据比赛id对盘口做分组
    const groupedRecords = groupBy(surebetRecords, (t) => t.crown_match_id)

    //待处理的盘口抛入到队列
    for (const group of Object.values(groupedRecords)) {
        //判断一下盘口所属的比赛，如果比赛的状态不为空，那么表示比赛已经计算完了，那么盘口就不要了
        const match = await Match.findOne({
            where: {
                crown_match_id: group[0].crown_match_id,
            },
            attributes: ['id', 'status'],
        })
        if (match && match.status !== '') {
            continue
        }

        if (group[0].match_time - Date.now() <= 180000) {
            //如果比赛是5分钟内的，那么直接抛到最终判断队列
            await publisher.publish(
                FINAL_QUEUE_NAME,
                JSON.stringify({
                    type: 'direct',
                    odds: group,
                }),
            )
            console.log('抛入到最终判断队列', `crown_match_id=${group[0].crown_match_id}`)
        } else {
            //抛入到第一次判断队列
            await publisher.publish(FIRST_QUEUE_NAME, JSON.stringify(group))
            console.log('抛入到第一次判断队列', `crown_match_id=${group[0].crown_match_id}`)
        }
    }
}

/**
 * 启动Surebet盘口抓取
 */
export async function startSurebetRobot() {
    const limiter = new RateLimiter(10000)
    while (true) {
        await limiter.next()

        try {
            if (!publisher) {
                publisher = await startPublisher(FIRST_QUEUE_NAME)
            }
            await run()
        } catch (err) {
            console.error(err)
        }
    }
}

if (require.main === module) {
    startSurebetRobot()
}
