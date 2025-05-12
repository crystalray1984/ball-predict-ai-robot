declare namespace Surebet {}

/**
 * 比赛时段
 */
declare type Period = 'regularTime' | 'period1'

/**
 * 投注目标
 */
declare type Variety = 'goal' | 'corner'

/**
 * 投注方向
 */
declare type OddType = 'ah1' | 'ah2' | 'over' | 'under' | 'draw'

/**
 * 盘口状态
 */
declare type OddStatus = '' | 'ready' | 'promoted' | 'skip' | 'ignored'

/**
 * 二次比对完成时的规则
 */
declare type PromotedFinalRule = '' | 'crown' | 'crown_special' | 'titan007'

/**
 * 比赛状态
 */
declare type MatchStatus = '' | 'final'

/**
 * 比赛异常状态
 */
declare type MatchErrorStatus = '' | 'delayed' | 'cancelled' | 'interrupted'

/**
 * 接口响应数据
 */
declare interface ApiResp<T = void> {
    code: number
    msg: string
    data: T
}
