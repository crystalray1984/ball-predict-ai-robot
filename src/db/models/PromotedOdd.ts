import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import {
    AutoIncrement,
    Column,
    CreatedAt,
    DataType,
    Model,
    PrimaryKey,
    Table,
} from 'sequelize-typescript'

/**
 * 最终推荐盘口表
 */
@Table({ tableName: 'promoted_odd', updatedAt: false })
export class PromotedOdd extends Model<
    InferAttributes<PromotedOdd>,
    InferCreationAttributes<PromotedOdd>
> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: CreationOptional<number>

    /**
     * 原始盘口id
     */
    @Column(DataType.INTEGER)
    declare odd_id: number

    /**
     * 比赛id
     */
    @Column(DataType.INTEGER)
    declare match_id: number

    @Column(DataType.STRING(50))
    declare variety: string

    @Column(DataType.STRING(50))
    declare period: string

    @Column(DataType.STRING(50))
    declare type: string

    @Column(DataType.DECIMAL(10, 2))
    declare condition: string

    /**
     * 是否反推
     */
    @Column(DataType.BOOLEAN)
    declare back: boolean

    /**
     * 推荐的规则，0-正常规则，1-特殊规则
     */
    @Column(DataType.INTEGER)
    declare special: CreationOptional<number>

    /**
     * 特殊规则用于判断的变盘
     */
    @Column(DataType.TEXT)
    declare special_odd: CreationOptional<string | null>

    /**
     * 记录创建时间
     */
    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>

    /**
     * 是否最终推荐
     */
    @Column(DataType.BOOLEAN)
    declare is_valid: CreationOptional<boolean>

    @Column(DataType.STRING(50))
    declare score: CreationOptional<string>

    /**
     * 赛果对应的输赢
     */
    @Column(DataType.INTEGER)
    declare result: CreationOptional<number>
}
