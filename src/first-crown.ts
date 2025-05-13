import { startConsumer } from './common/amqp'
import { FIRST_QUEUE_NAME } from './common/constants'
import { getCrownData, init } from './crown'

/**
 * 处理需要一次比对的盘口
 * @param records
 */
async function processRecords(records: Surebet.Output[]) {
    const crown_match_id = records[0].crown_match_id

    //判断是读“今日”还是“早盘”，比赛时间距离现在超过16个小时的是早盘
    const show_type = records[0].match_time - Date.now() >= 16 * 3600000 ? 'early' : 'today'

    //读取皇冠盘口
    const crownData = await getCrownData(crown_match_id, show_type)
    if (!crownData || !Array.isArray(crownData.game)) {
        console.error('皇冠请求数据异常', crown_match_id)
        //抓不到皇冠数据的，不进入盘口中
        return
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
