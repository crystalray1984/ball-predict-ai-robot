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
 * 队伍表
 */
@Table({ tableName: 'surebet_records', timestamps: true, updatedAt: false })
export class SurebetRecord extends Model<
    InferAttributes<SurebetRecord>,
    InferCreationAttributes<SurebetRecord>
> {
    /**
     * 盘口id
     */
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: CreationOptional<number>

    /**
     * 皇冠比赛id
     */
    @Column(DataType.STRING)
    declare crown_match_id: string

    /**
     * 比赛时间
     */
    @Column(DataType.DATE)
    declare match_time: Date

    @Column(DataType.STRING(50))
    declare team1: string

    @Column(DataType.STRING(50))
    declare team2: string

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

    @Column(DataType.STRING(50))
    declare condition: string | null

    /**
     * surebet推送水位
     */
    @Column(DataType.DECIMAL(10, 4))
    declare value: string

    /**
     * 记录创建时间
     */
    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>
}
