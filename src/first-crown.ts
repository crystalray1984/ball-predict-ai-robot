import { startConsumer } from './common/amqp'
import { FIRST_QUEUE_NAME } from './common/constants'
import { getCrownData, init } from './crown'
import { compareReadyData } from './crown/compare'
import { Match, Odd } from './db'

/**
 * 处理需要一次比对的盘口
 * @param records
 */
async function processRecords(records: Surebet.Output[]) {
    //先对盘口做一次筛选，如果盘口已经存在且状态不为空则跳过
    const filtered: { surebet: Surebet.Output; odd: Odd | null }[] = []
    for (const record of records) {
        const odd = await Odd.findOne({
            where: {
                crown_match_id: record.crown_match_id,
                variety: record.type.variety,
                period: record.type.period,
                type: record.type.type,
                condition: record.type.condition,
            },
        })
        if (odd && odd.status !== '') continue
        filtered.push({
            surebet: record,
            odd,
        })
    }

    if (filtered.length === 0) return

    const crown_match_id = filtered[0].surebet.crown_match_id

    //判断是读“今日”还是“早盘”，比赛时间距离现在超过12个小时的是早盘
    const show_type =
        filtered[0].surebet.match_time - Date.now() >= 16 * 3600000 ? 'early' : 'today'

    //读取皇冠盘口
    const crownData = await getCrownData(crown_match_id, show_type)
    if (!crownData || !Array.isArray(crownData.game)) {
        console.error('皇冠请求数据异常', crown_match_id)
        //抓不到皇冠数据的，不进入盘口中
        return
    }

    //对列表中的每个盘口做皇冠比对
    for (const row of filtered) {
        const result = await compareReadyData(row.surebet, crownData)
        if (!result) {
            //皇冠没有返回对应的盘口，直接丢弃
            continue
        }

        if (row.odd) {
            //盘口已经存在就更新
            await Odd.update(
                {
                    surebet_value: row.surebet.surebet_value,
                    crown_value: result.data.value,
                    status: result.pass ? 'ready' : '',
                },
                {
                    where: {
                        id: row.odd.id,
                    },
                },
            )
        } else {
            //否则就是新增
            const match_id = await Match.prepare({
                ...result.game,
                crown_match_id,
                match_time: row.surebet.match_time,
            })

            await Odd.create(
                {
                    match_id,
                    crown_match_id,
                    variety: row.surebet.type.variety,
                    period: row.surebet.type.period,
                    type: row.surebet.type.type,
                    condition: row.surebet.type.condition,
                    surebet_value: row.surebet.surebet_value,
                    crown_value: result.data.value,
                    status: result.pass ? 'ready' : '',
                },
                {
                    returning: false,
                },
            )
        }

        if (result.pass) {
            console.log('新增一次比对完成数据')
        }
    }
}

/**
 * 启动皇冠盘口首次比对
 */
export async function startFirstCrownRobot() {
    //初始化皇冠浏览器
    await init()

    while (true) {
        try {
            await startConsumer({
                queue: FIRST_QUEUE_NAME,
                onMessage: async (msg) => {
                    const records: Surebet.Output[] = JSON.parse(msg.content.toString('utf-8'))
                    if (records.length === 0) return
                    console.log('处理皇冠盘口比对', records[0].crown_match_id)
                    await processRecords(records)
                },
            })
        } catch (err) {
            console.error(err)
        }
    }
}

if (require.main === module) {
    startFirstCrownRobot()
}
