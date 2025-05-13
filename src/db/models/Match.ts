import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import {
    AutoIncrement,
    Column,
    CreatedAt,
    DataType,
    Model,
    PrimaryKey,
    Table,
    UpdatedAt,
} from 'sequelize-typescript'
import { Tournament } from './Tournament'
import { Team } from './Team'

/**
 * 比赛表
 */
@Table({ tableName: 'match' })
export class Match extends Model<InferAttributes<Match>, InferCreationAttributes<Match>> {
    /**
     * 比赛id
     */
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: CreationOptional<number>

    /**
     * 联赛id
     */
    @Column(DataType.INTEGER)
    declare tournament_id: number

    /**
     * 皇冠比赛id
     */
    @Column(DataType.STRING)
    declare crown_match_id: string

    /**
     * 球探网比赛id
     */
    @Column(DataType.STRING)
    declare titan007_match_id: CreationOptional<string>

    /**
     * 主队id
     */
    @Column(DataType.INTEGER)
    declare team1_id: number

    /**
     * 客队id
     */
    @Column(DataType.INTEGER)
    declare team2_id: number

    /**
     * 比赛时间
     */
    @Column(DataType.DATE)
    declare match_time: Date

    /**
     * 比赛状态
     */
    @Column(DataType.STRING)
    declare status: CreationOptional<MatchStatus>

    /**
     * 比赛异常状态
     */
    @Column(DataType.STRING)
    declare error_status: CreationOptional<MatchErrorStatus>

    /**
     * 是否已有上半场赛果
     */
    @Column(DataType.TINYINT)
    declare has_period1_score: CreationOptional<number>

    /**
     * 主队上半场进球
     */
    @Column(DataType.INTEGER)
    declare score1_period1: CreationOptional<number | null>

    /**
     * 客队上半场进球
     */
    @Column(DataType.INTEGER)
    declare score2_period1: CreationOptional<number | null>

    /**
     * 主队上半场角球
     */
    @Column(DataType.INTEGER)
    declare corner1_period1: CreationOptional<number | null>

    /**
     * 客队上半场角球
     */
    @Column(DataType.INTEGER)
    declare corner2_period1: CreationOptional<number | null>

    /**
     * 是否已有赛果
     */
    @Column(DataType.TINYINT)
    declare has_score: CreationOptional<number>

    /**
     * 主队进球
     */
    @Column(DataType.INTEGER)
    declare score1: CreationOptional<number | null>

    /**
     * 客队进球
     */
    @Column(DataType.INTEGER)
    declare score2: CreationOptional<number | null>

    /**
     * 主队角球
     */
    @Column(DataType.INTEGER)
    declare corner1: CreationOptional<number | null>

    /**
     * 客队角球
     */
    @Column(DataType.INTEGER)
    declare corner2: CreationOptional<number | null>

    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>

    @UpdatedAt
    @Column(DataType.DATE)
    declare updated_at: CreationOptional<Date>

    /**
     * 准备比赛
     */
    static async prepare(
        data: Pick<
            Crown.Game,
            'lid' | 'league' | 'team_c' | 'team_h' | 'team_id_c' | 'team_id_h'
        > & { match_time: number; crown_match_id: string },
    ): Promise<number> {
        //先看看比赛是否存在
        let match = await Match.findOne({
            where: {
                crown_match_id: data.crown_match_id,
            },
            attributes: ['id'],
        })
        if (match) {
            return match.id
        }

        //尝试获取联赛id
        const [tournament] = await Tournament.findOrCreate({
            where: {
                crown_tournament_id: data.lid,
            },
            defaults: {
                crown_tournament_id: data.lid,
                name: data.league,
            },
            attributes: ['id'],
        })

        //准备好队伍
        const team1_id = await Team.prepare(data.team_id_h, data.team_h)
        const team2_id = await Team.prepare(data.team_id_c, data.team_c)

        //插入比赛数据
        match = await Match.create(
            {
                tournament_id: tournament.id,
                crown_match_id: data.crown_match_id,
                team1_id,
                team2_id,
                match_time: new Date(data.match_time),
            },
            {
                returning: ['id'],
            },
        )

        return match.id
    }
}
