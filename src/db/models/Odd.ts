import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import {
    BelongsTo,
    Column,
    CreatedAt,
    DataType,
    ForeignKey,
    Model,
    Table,
} from 'sequelize-typescript'
import { Match } from './Match'

/**
 * 队伍表
 */
@Table({ tableName: 'odd', timestamps: true, updatedAt: false })
export class Odd
    extends Model<InferAttributes<Odd>, InferCreationAttributes<Odd>>
    implements Surebet.OddType
{
    /**
     * 盘口id
     */
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
    })
    declare id: CreationOptional<number>

    /**
     * 比赛id
     */
    @ForeignKey(() => Match)
    @Column(DataType.INTEGER)
    declare match_id: number

    /**
     * 所属的比赛
     */
    @BelongsTo(() => Match)
    declare match: CreationOptional<Match>

    /**
     * 皇冠比赛id
     */
    @Column(DataType.INTEGER)
    declare crown_match_id: number

    @Column(DataType.STRING(50))
    declare game: string

    @Column(DataType.STRING(50))
    declare base: string

    @Column(DataType.STRING(50))
    declare variety: string

    @Column(DataType.STRING(50))
    declare period: string

    @Column(DataType.STRING(50))
    declare type: string

    @Column(DataType.DECIMAL(10, 2))
    declare condition: string

    /**
     * surebet赔率
     */
    @Column(DataType.DECIMAL(10, 4))
    declare surebet_value: string

    /**
     * 皇冠赔率
     */
    @Column(DataType.DECIMAL(10, 4))
    declare crown_value: string

    /**
     * 盘口状态
     */
    @Column(DataType.STRING(50))
    declare status: CreationOptional<string>

    /**
     * 记录创建时间
     */
    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>

    /**
     * surebet数据更新时间
     */
    @Column(DataType.DATE)
    declare surebet_updated_at: Date

    /**
     * 皇冠数据更新时间
     */
    @Column(DataType.DATE)
    declare crown_updated_at: CreationOptional<Date>
}
