import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import { Column, CreatedAt, DataType, HasMany, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { Odd } from './Odd'

/**
 * 比赛表
 */
@Table({ tableName: 'match' })
export class Match extends Model<InferAttributes<Match>, InferCreationAttributes<Match>> {
    /**
     * 队伍id
     */
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
    })
    declare id: CreationOptional<number>

    /**
     * 赛事id
     */
    @Column(DataType.INTEGER)
    declare tournament_id: number

    /**
     * 皇冠比赛id
     */
    @Column(DataType.INTEGER)
    declare crown_match_id: number

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
     * 记录创建时间
     */
    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>

    /**
     * 记录更新时间
     */
    @UpdatedAt
    @Column(DataType.DATE)
    declare updated_at: CreationOptional<Date>

    @HasMany(() => Odd)
    declare odds: CreationOptional<Odd[]>

    /**
     * 比赛的推荐状态
     */
    @Column(DataType.STRING(50))
    declare status: CreationOptional<string>
}
