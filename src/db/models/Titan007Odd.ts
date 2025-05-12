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
 * 球探网盘口表
 */
@Table({ tableName: 'titan007_odd', timestamps: true })
export class Titan007Odd extends Model<
    InferAttributes<Titan007Odd>,
    InferCreationAttributes<Titan007Odd>
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
     * 全场比分最早盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare ah_start: CreationOptional<string | null>

    /**
     * 全场比分最终盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare ah_end: CreationOptional<string | null>

    /**
     * 全场大小球最早盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare goal_start: CreationOptional<string | null>

    /**
     * 全场大小球最终盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare goal_end: CreationOptional<string | null>

    /**
     * 上半场比分最早盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare ah_period1_start: CreationOptional<string | null>

    /**
     * 上半场比分最终盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare ah_period1_end: CreationOptional<string | null>

    /**
     * 上半场大小球最早盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare goal_period1_start: CreationOptional<string | null>

    /**
     * 上半场大小球最终盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare goal_period1_end: CreationOptional<string | null>

    /**
     * 角球最早盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare corner_ah_start: CreationOptional<string | null>

    /**
     * 角球最终盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare corner_ah_end: CreationOptional<string | null>

    /**
     * 角球大小球最早盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare corner_goal_start: CreationOptional<string | null>

    /**
     * 角球大小球最终盘口
     */
    @Column(DataType.DECIMAL(5, 2))
    declare corner_goal_end: CreationOptional<string | null>

    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>

    @UpdatedAt
    @Column(DataType.DATE)
    declare updated_at: CreationOptional<Date>
}
