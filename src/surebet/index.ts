import Decimal from 'decimal.js'
import { omit } from 'lodash'
import { isEmpty } from '../common/helpers'
import { getSetting } from '../common/settings'
import { CONFIG } from '../config'
import { getAllOdds, GetOddsOptions } from './api'

/**
 * 获取surebet数据
 */
export async function getSurebets() {
    //读取系统配置
    const settings = await getSetting(
        'surebet_outcomes',
        'surebet_max_profit',
        'surebet_min_profit',
        'surebet_start_of',
        'surebet_end_of',
        'min_surebet_value',
        'max_surebet_value',
    )

    //构建请求surebet的数据
    const options: GetOddsOptions = {
        token: CONFIG.surebet_token,
        product: 'surebets',
        source: '188bet|bet365',
        sport: 'Football',
        limit: 100,
        oddsFormat: 'eu',
        outcomes: settings.surebet_outcomes,
        'min-profit': settings.surebet_min_profit,
        'max-profit': settings.surebet_max_profit,
        'hide-different-rules': 'True',
        startOf: settings.surebet_start_of,
        endOf: settings.surebet_end_of,
    }

    //获取所有的推荐盘口数据
    const records = await getAllOdds(options)

    const outupt: Surebet.Output[] = []

    //对盘口进行筛选
    for (const record of records) {
        //只筛选188bet的数据
        const odd = record.prongs.find((t) => t.bk === '188bet')
        if (!odd) continue

        if (odd.type.game !== 'regular' || odd.type.base !== 'overall') continue

        //数据过滤，只留下需要的盘口
        let pass = false

        //全场让球
        if (
            odd.type.variety === 'goal' &&
            odd.type.period === 'regularTime' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //全场大小球
        if (
            odd.type.variety === 'goal' &&
            odd.type.period === 'regularTime' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //全场角球让球
        if (
            odd.type.variety === 'corner' &&
            odd.type.period === 'regularTime' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //全场角球大小球
        if (
            odd.type.variety === 'corner' &&
            odd.type.period === 'regularTime' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场让球
        if (
            odd.type.variety === 'goal' &&
            odd.type.period === 'period1' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场大小球
        if (
            odd.type.variety === 'goal' &&
            odd.type.period === 'period1' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场角球让球
        if (
            odd.type.variety === 'corner' &&
            odd.type.period === 'period1' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场角球大小球
        if (
            odd.type.variety === 'corner' &&
            odd.type.period === 'period1' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //赔率大于指定的值
        const surebet_value = Decimal(odd.value)

        if (!isEmpty(settings.min_surebet_value)) {
            if (!surebet_value.gte(settings.min_surebet_value)) {
                pass = false
            }
        }

        if (!isEmpty(settings.max_surebet_value)) {
            if (!surebet_value.lte(settings.max_surebet_value)) {
                pass = false
            }
        }

        if (!pass) continue

        //把数据放到返回数组中
        outupt.push({
            crown_match_id: odd.preferred_nav.markers.eventId,
            match_time: odd.time,
            type: omit(odd.type, 'game', 'base'),
            surebet_value: String(odd.value),
        })
    }

    return outupt
}
