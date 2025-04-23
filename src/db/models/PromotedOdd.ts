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
    declare variety: Surebet.OddType['variety']

    @Column(DataType.STRING(50))
    declare period: Surebet.OddType['period']

    @Column(DataType.STRING(50))
    declare type: Surebet.OddType['type']

    @Column(DataType.DECIMAL(10, 2))
    declare condition: string

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
}
