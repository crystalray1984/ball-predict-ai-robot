import Decimal from 'decimal.js'
import { isEmpty } from '../common/helpers'
import { getSetting } from '../common/settings'

export interface MatchGameData {
    /**
     * 投注条件
     */
    condition: string
    /**
     * 赔率
     */
    value: string
}

/**
 * 由皇冠比对后的盘口数据
 */
export interface MatchOddData {
    //盘口基础信息
    game: Crown.Game
    /**
     * 投注信息
     */
    data: MatchGameData
    /**
     * 是否比对通过
     */
    pass: boolean
}

/**
 * 根据surebet的盘口类型，获取皇冠的对应盘口
 * @param type
 * @param game
 */
function getGameData(type: Surebet.Output['type'], game: Crown.Game): MatchGameData | void {
    /**
     * 表示该盘口是否开启的字段名
     */
    const switchKey = (() => {
        if (type.period === 'regularTime') {
            //全场
            switch (type.type) {
                case 'ah1':
                case 'ah2':
                    //全场让球
                    return 'sw_R'
                default:
                    //全场大小球
                    return 'sw_OU'
            }
        } else {
            //上半场
            switch (type.type) {
                case 'ah1':
                case 'ah2':
                    //上半场让球
                    return 'sw_HR'
                default:
                    //上半场大小球
                    return 'sw_HOU'
            }
        }
    })()

    if (game[switchKey] !== 'Y') {
        //如果盘口未开启就直接返回
        return
    }

    let value: string, condition: string
    if (type.period === 'regularTime') {
        //全场
        switch (type.type) {
            case 'ah1':
                //全场让球—主胜
                condition = changeRatio(game.ratio)
                if (game.strong === 'H') {
                    //主队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_RH, game.ior_RC)[0]
                break
            case 'ah2':
                //全场让球-客胜
                condition = changeRatio(game.ratio)
                if (game.strong === 'C') {
                    //客队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_RH, game.ior_RC)[1]
                break
            case 'under':
                //全场大小球-小球
                condition = changeRatio(game.ratio_o)
                value = changeValue(game.ior_OUH, game.ior_OUC)[0]
                break
            default:
                //全场大小球-大球
                condition = changeRatio(game.ratio_o)
                value = changeValue(game.ior_OUH, game.ior_OUC)[1]
                break
        }
    } else {
        //上半场
        switch (type.type) {
            case 'ah1':
                //上半场让球—主胜
                condition = changeRatio(game.hratio)
                if (game.hstrong === 'H') {
                    //主队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_HRH, game.ior_HRC)[0]
                break
            case 'ah2':
                //上半场让球-客胜
                condition = changeRatio(game.hratio)
                if (game.hstrong === 'C') {
                    //客队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_HRH, game.ior_HRC)[1]
                break
            case 'under':
                //上半场大小球-小球
                condition = changeRatio(game.ratio_ho)
                value = changeValue(game.ior_HOUH, game.ior_HOUC)[0]
                break
            default:
                //上半场大小球-大球
                condition = changeRatio(game.ratio_ho)
                value = changeValue(game.ior_HOUH, game.ior_HOUC)[1]
                break
        }
    }

    return {
        condition,
        value,
    }
}

/**
 * 皇冠数据第一次比对逻辑
 * @param surebet 来自surebet的盘口数据
 * @param crown 来自皇冠的盘口数据
 */
export async function compareReadyData(
    surebet: Surebet.Output,
    crown: Crown.Resp,
): Promise<MatchOddData | void> {
    //读取配置
    const ready_condition = await getSetting<string>('ready_condition')

    //根据surebet的盘口类型寻找皇冠数据中的对应盘口
    const games = crown.game.filter((game) => {
        if (surebet.type.variety === 'goal') {
            //进球
            return game.ptype_id == '0'
        } else {
            //角球
            return game.ptype_id == '146'
        }
    })

    //从各个盘口中寻找与当前盘口相同的盘口
    const data = games.reduce<MatchGameData | undefined>((prev, game) => {
        if (prev) return prev
        //寻找相同的盘口
        const data = getGameData(surebet.type, game)
        if (!data) return
        if (Decimal(data.condition).equals(surebet.type.condition!)) {
            //条件也相同
            return data
        }
    }, undefined)

    if (!data) {
        //没有从皇冠中找到相同的盘口
        return
    }

    //主盘口的信息
    const game = crown.game.filter((game) => game.ptype_id == '0')[0] ?? crown.game[0]

    //第一次比对的水位判断
    let pass = true
    if (!isEmpty(ready_condition)) {
        pass = Decimal(data.value).sub(surebet.surebet_value).gte(ready_condition)
    }

    return {
        game,
        data,
        pass,
    }
}

/**
 * 计算皇冠的赔率，从原始的亚赔数据转换为欧赔
 * @param value1 主队赔率
 * @param value2 客队赔率
 */
function changeValue(value1: string, value2: string) {
    function chg_ior(iorH: number, iorC: number): [string, string] {
        iorH = Math.floor(iorH * 1e3 + 0.001) / 1e3
        iorC = Math.floor(iorC * 1e3 + 0.001) / 1e3
        if (iorH < 11) iorH *= 1e3
        if (iorC < 11) iorC *= 1e3
        iorH = parseFloat(iorH as unknown as string)
        iorC = parseFloat(iorC as unknown as string)
        const ior = get_EU_ior(iorH, iorC)
        ior[0] /= 1e3
        ior[1] /= 1e3
        return [printf(Decimal_point(ior[0], 100), 2), printf(Decimal_point(ior[1], 100), 2)]
    }

    function get_EU_ior(H_ratio: number, C_ratio: number): [number, number] {
        const out_ior = get_HK_ior(H_ratio, C_ratio)
        H_ratio = out_ior[0]
        C_ratio = out_ior[1]
        out_ior[0] = H_ratio + 1e3
        out_ior[1] = C_ratio + 1e3
        return out_ior
    }

    function get_HK_ior(H_ratio: number, C_ratio: number) {
        const out_ior = [] as unknown as [number, number]
        let line: number, lowRatio: number, nowRatio: number, highRatio: number
        let nowType = ''
        if (H_ratio <= 1e3 && C_ratio <= 1e3) {
            out_ior[0] = Math.floor(H_ratio / 10 + 1e-4) * 10
            out_ior[1] = Math.floor(C_ratio / 10 + 1e-4) * 10
            return out_ior
        }
        line = 2e3 - (H_ratio + C_ratio)
        if (H_ratio > C_ratio) {
            lowRatio = C_ratio
            nowType = 'C'
        } else {
            lowRatio = H_ratio
            nowType = 'H'
        }
        if (2e3 - line - lowRatio > 1e3) nowRatio = (lowRatio + line) * -1
        else nowRatio = 2e3 - line - lowRatio
        if (nowRatio < 0) highRatio = Math.floor(Math.abs(1e3 / nowRatio) * 1e3)
        else highRatio = 2e3 - line - nowRatio
        if (nowType == 'H') {
            out_ior[0] = Math.floor(lowRatio / 10 + 1e-4) * 10
            out_ior[1] = Math.floor(highRatio / 10 + 1e-4) * 10
        } else {
            out_ior[0] = Math.floor(highRatio / 10 + 1e-4) * 10
            out_ior[1] = Math.floor(lowRatio / 10 + 1e-4) * 10
        }
        return out_ior
    }

    function Decimal_point(tmpior: number, show: number) {
        var sign = ''
        sign = tmpior < 0 ? 'Y' : 'N'
        tmpior = Math.floor(Math.abs(tmpior) * show + 1 / show) / show
        return tmpior * (sign == 'Y' ? -1 : 1)
    }

    function printf(vals: number, points: number) {
        let strVals = '' + vals
        var cmd = new Array()
        cmd = strVals.split('.')
        if (cmd.length > 1)
            for (let ii = 0; ii < points - cmd[1].length; ii++) strVals = strVals + '0'
        else {
            strVals = strVals + '.'
            for (let ii = 0; ii < points; ii++) strVals = strVals + '0'
        }
        return strVals
    }

    return chg_ior(value1 as unknown as number, value2 as unknown as number)
}

/**
 * 计算让球值，从皇冠的带/的格式转换为2位小数
 * @param ratio 原始让球数值
 * @param strong 让球方，如果是用来计算大小球，那么传入C
 */
function changeRatio(ratio: string) {
    let parts = ratio.split('/').map((t) => t.trim())
    if (parts.length === 1) {
        //单个让球值
        return parts[0]
    } else {
        //两个让球值
        return Decimal(parts[0]).add(parts[1]).div(2).toString()
    }
}
