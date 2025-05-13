import type { InferAttributes } from 'sequelize'
import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript'

/**
 * 比赛表
 */
@Table({ tableName: 'v_match', timestamps: false })
export class VMatch extends Model<InferAttributes<VMatch>> {
    /**
     * 比赛id
     */
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /**
     * 联赛id
     */
    @Column(DataType.INTEGER)
    declare tournament_id: number

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare tournament_name: string

    /**
     * 皇冠比赛id
     */
    @Column(DataType.STRING)
    declare crown_match_id: string

    /**
     * 球探网比赛id
     */
    @Column(DataType.STRING)
    declare titan007_match_id: string

    /**
     * 主队id
     */
    @Column(DataType.INTEGER)
    declare team1_id: number

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare team1_crown_id: string

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare team1_titan007_id: string

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare team1_name: string

    /**
     * 客队id
     */
    @Column(DataType.INTEGER)
    declare team2_id: number

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare team2_crown_id: string

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare team2_titan007_id: string

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare team2_name: string

    /**
     * 比赛时间
     */
    @Column(DataType.DATE)
    declare match_time: Date

    /**
     * 比赛状态
     */
    @Column(DataType.STRING)
    declare status: MatchStatus

    /**
     * 比赛异常状态
     */
    @Column(DataType.STRING)
    declare error_status: MatchErrorStatus

    /**
     * 是否已有上半场赛果
     */
    @Column(DataType.TINYINT)
    declare has_period1_score: number

    /**
     * 主队上半场进球
     */
    @Column(DataType.INTEGER)
    declare score1_period1: number | null

    /**
     * 客队上半场进球
     */
    @Column(DataType.INTEGER)
    declare score2_period1: number | null

    /**
     * 主队上半场角球
     */
    @Column(DataType.INTEGER)
    declare corner1_period1: number | null

    /**
     * 客队上半场角球
     */
    @Column(DataType.INTEGER)
    declare corner2_period1: number | null

    /**
     * 是否已有赛果
     */
    @Column(DataType.TINYINT)
    declare has_score: number | null

    /**
     * 主队进球
     */
    @Column(DataType.INTEGER)
    declare score1: number | null

    /**
     * 客队进球
     */
    @Column(DataType.INTEGER)
    declare score2: number | null

    /**
     * 主队角球
     */
    @Column(DataType.INTEGER)
    declare corner1: number | null

    /**
     * 客队角球
     */
    @Column(DataType.INTEGER)
    declare corner2: number | null

    @Column(DataType.DATE)
    declare created_at: Date

    @Column(DataType.DATE)
    declare updated_at: Date
}
