declare namespace Surebet {
    /**
     * surebet响应数据
     */
    interface OddsResp {
        /**
         * 响应生成的时间
         */
        updated_at: number

        /**
         * 是否可以向前浏览列表
         */
        can_forward: boolean

        /**
         * 是否可以向后浏览列表
         */
        can_backward: boolean

        /**
         * 输出的记录数
         */
        limit: number

        /**
         * 推荐数据
         */
        records: OddsRecord[]
    }

    /**
     * 盘口推荐列表
     */
    interface OddsRecord {
        /**
         * 排序字段
         */
        sort_by: number
        /**
         * 记录id
         */
        id: string
        /**
         * 推荐的盘口
         */
        prongs: OddInfo[]
    }

    /**
     * 盘口类型标识数据
     */
    interface OddType {
        /** 投注类型对应的条件；描述投注的额外变量参数 */
        condition?: string

        /**
         此参数指示事件发生时的游戏情况类型。
        regular - 默认的游戏情况。 例如，投注比赛结果。
        first - 比赛双方竞争打进第一个进球/第一个角球/第一张牌等的情况。
        № 2 - 比赛双方竞争打进第二个进球/第二个角球/第二张牌等的情况。
        last - 类似于“first”的情况，但用于最后一个进球/角球/牌等。
         openingPartnership - 在板球中，最佳的开场搭档。
        等等。
        */
        game: string

        /**
          此参数确定投注适用的球队，可以取以下值：
        overall - 主场和/或客场球队（例如，比赛总分）。
        home - 主场球队。
        away - away - 客场球队。
        both - 主客场球队均适用（例如，两队均得分）。
        */
        base: string

        /**
        一种可以计数的比赛结果类型，用于接受投注。
        进球、角球、牌、局、盘、点等都属于 "variety"。
        */
        variety: string

        /**
        接受投注的时间段或比赛部分。
        例如：加时赛、常规时间、第一节、第一盘等都属于 "periods"。
        */
        period: string

        /**
        此参数描述投注的逻辑含义，可以取以下值：
        win1 - 球队1获胜。
        win1RetX - 球队1获胜，但如果打平，投注退款。
        win2 - 球队2获胜。
        win2RetX - 球队2获胜，但如果打平，投注退款。
        draw - 平局。
        over - 大。
        under - 小。
        yes - 发生。
        no - 不发生。
        odd - 单数。
        even - 双数。
        ah1 - 球队1的亚洲让分。
        ah2 - 球队2的亚洲让分。
        eh1 - 球队1的欧洲让分。
        ehx - 平局的欧洲让分。
        eh2 - 球队2的欧洲让分。

        等等。
        某些投注类型可能包含额外条件。 例如，对于大于和小于的投注，它是总数，
        对于ah1/ah2/eh1/ehx/eh2的投注，它是让球值。 所有这些值将包含在单独的 condition 参数中。
        */
        type: string
    }

    interface OddInfo {
        /**
         * 赔率值
         */
        value: number
        /**
         * 博彩公司标识
         */
        bk: string
        /**  博彩公司网站显示的比赛开始时间 */
        time: number
        /**
         * 投注类型
         */
        type: OddType
        /**
         * 导航信息
         */
        preferred_nav: {
            markers: {
                eventId: string
            }
        }
        /**
         * 球队名称
         */
        teams: string[]
    }

    /**
     * surebet经过初步筛选后的数据
     */
    interface OutputData {
        /**
         * 皇冠比赛id
         */
        crown_match_id: string
        /**
         * 比赛时间
         */
        match_time: number
        /**
         * 盘口类型
         */
        type: OddType
        /**
         * surebet推荐赔率
         */
        surebet_value: string
    }
}

declare namespace Crown {
    /**
     * 由皇冠返回的比赛数据
     */
    interface MatchInfo {
        /**
         * 比赛时间
         */
        match_time?: number | Date
        /**
         * 皇冠比赛id
         */
        ecid: string
        /**
         * 赛事名称
         */
        league: string
        /**
         * 皇冠赛事id
         */
        lid: string
        /**
         * 主队名称
         */
        team_h: string
        /**
         * 客队名称
         */
        team_c: string
        /**
         * 主队id
         */
        team_id_h: string
        /**
         * 客队id
         */
        team_id_c: string
    }

    /**
     * 皇冠返回的单个盘口数据
     */
    interface Game extends MatchInfo {
        /**
         * 盘口类型 0-赛果 146-角球
         */
        ptype_id: string
        /**
         * 让球方
         */
        strong: 'H' | 'C'
        /**
         * 全场让球是否开启
         */
        sw_R: 'Y' | 'N'
        /**
         * 全场让球数
         */
        ratio: string
        /**
         * 主队让球赔率
         */
        ior_RH: string
        /**
         * 客队让球赔率
         */
        ior_RC: string
        /**
         * 上半场让球方
         */
        hstrong: 'H' | 'C'
        /**
         * 上半场让球是否开启
         */
        sw_HR: 'Y' | 'N'
        /**
         * 上半场让球数
         */
        hratio: string
        /**
         * 上半场主队让球赔率
         */
        ior_HRH: string
        /**
         * 上半场客队让球赔率
         */
        ior_HRC: string
        /**
         * 全场大小球是否开启
         */
        sw_OU: 'Y' | 'N'
        /**
         * 全场大小球临界点
         */
        ratio_o: string
        /**
         * 全场小球赔率
         */
        ior_OUH: string
        /**
         * 全场大球赔率
         */
        ior_OUC: string
        /**
         * 上半场大小球是否开启
         */
        sw_HOU: 'Y' | 'N'
        /**
         * 上半场大小球临界点
         */
        ratio_ho: string
        /**
         * 上半场小球赔率
         */
        ior_HOUH: string
        /**
         * 上半场大球赔率
         */
        ior_HOUC: string
    }

    /**
     * 皇冠接口返回的数据
     */
    interface Resp {
        /**
         * 盘口数据
         */
        game: Game[]
    }
}

declare interface ApiResp<T> {
    code: number
    msg: string
    data: T
}

/**
 * 比赛数据统计
 */
declare interface TechData {
    corner1: number | null
    corner2: number | null
    corner1_period1: number | null
    corner2_period1: number | null
}

/**
 * 单场比赛的赛果数据
 */
declare interface MatchScore extends TechData {
    score1: number
    score2: number
    score1_period1: number
    score2_period1: number
}

/**
 * 包含比赛id的单场赛果
 */
declare interface MatchScoreWithId extends MatchScore {
    match_id: number
    period1: boolean
}

/**
 * 球探网比赛信息
 */
declare interface Titan007MatchInfo {
    match_id: string
    time: Date
    match_time: number
    team1: string
    team2: string
}

/**
 * 特殊正反推逻辑
 */
declare interface SpecialReverseRule {
    /** 投注类型对应的条件；描述投注的额外变量参数 */
    condition: string

    /**
     * 条件对应的符号
     */
    condition_symbol: '=' | '<' | '>' | '<=' | '>='

    /**
    一种可以计数的比赛结果类型，用于接受投注。
    进球、角球、牌、局、盘、点等都属于 "variety"。
    */
    variety: string

    /**
    接受投注的时间段或比赛部分。
    例如：加时赛、常规时间、第一节、第一盘等都属于 "periods"。
    */
    period: string

    /**
    此参数描述投注的逻辑含义，可以取以下值：
    win1 - 球队1获胜。
    win1RetX - 球队1获胜，但如果打平，投注退款。
    win2 - 球队2获胜。
    win2RetX - 球队2获胜，但如果打平，投注退款。
    draw - 平局。
    over - 大。
    under - 小。
    yes - 发生。
    no - 不发生。
    odd - 单数。
    even - 双数。
    ah1 - 球队1的亚洲让分。
    ah2 - 球队2的亚洲让分。
    eh1 - 球队1的欧洲让分。
    ehx - 平局的欧洲让分。
    eh2 - 球队2的欧洲让分。

    等等。
    某些投注类型可能包含额外条件。 例如，对于大于和小于的投注，它是总数，
    对于ah1/ah2/eh1/ehx/eh2的投注，它是让球值。 所有这些值将包含在单独的 condition 参数中。
    */
    type: string

    /**
     * 是否反推
     */
    back: boolean
}
