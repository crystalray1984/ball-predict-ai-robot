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

/**
 * 最终推荐盘口表
 */
@Table({ tableName: 'promoted_odd', timestamps: true })
export class PromotedOdd extends Model<
    InferAttributes<PromotedOdd>,
    InferCreationAttributes<PromotedOdd>
> {
    /**
     * 盘口id
     */
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: CreationOptional<number>

    /**
     * 比赛id
     */

    @Column(DataType.INTEGER)
    declare match_id: number

    /**
     * 原始盘口id
     */

    @Column(DataType.INTEGER)
    declare odd_id: CreationOptional<number>

    /**
     * 手动推荐盘口id
     */

    @Column(DataType.INTEGER)
    declare manual_promote_odd_id: CreationOptional<number>

    /**
     * 是否最终推荐给用户
     */

    @Column(DataType.TINYINT)
    declare is_valid: CreationOptional<number>

    /**
     * 投注目标
     */

    @Column(DataType.STRING)
    declare variety: Variety

    /**
     * 比赛时段
     */

    @Column(DataType.STRING)
    declare period: Period

    /**
     * 投注方向
     */

    @Column(DataType.STRING)
    declare type: OddType

    /**
     * 第二投注方向
     */
    @Column(DataType.STRING)
    declare type2: CreationOptional<OddType | null>

    /**
     * 盘口条件
     */

    @Column(DataType.DECIMAL(5, 2))
    declare condition: string

    /**
     * 第二盘口条件
     */
    @Column(DataType.DECIMAL(5, 2))
    declare condition2: CreationOptional<OddType | null>

    /**
     * 是否反推
     */
    @Column(DataType.INTEGER)
    declare back: number

    /**
     * 二次比对规则
     */

    @Column(DataType.STRING)
    declare final_rule: PromotedFinalRule

    @Column(DataType.TINYINT)
    declare result: CreationOptional<number | null>

    @Column(DataType.TINYINT)
    declare result1: CreationOptional<number | null>

    @Column(DataType.TINYINT)
    declare result2: CreationOptional<number | null>

    @Column(DataType.STRING)
    declare score: CreationOptional<string | null>

    @Column(DataType.TINYINT)
    declare score1: CreationOptional<number | null>

    @Column(DataType.TINYINT)
    declare score2: CreationOptional<number | null>

    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>

    @UpdatedAt
    @Column(DataType.DATE)
    declare updated_at: CreationOptional<Date>
}
