import {
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from 'sequelize'
import {
    Column,
    CreatedAt,
    DataType,
    ForeignKey,
    HasMany,
    HasOne,
    Model,
    Table,
    UpdatedAt,
    BelongsTo,
} from 'sequelize-typescript'
import { Odd } from './Odd'
import { Team } from './Team'

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
    @ForeignKey(() => Team)
    @Column(DataType.INTEGER)
    declare team1_id: number

    @BelongsTo(() => Match, 'team1_id')
    declare team1: CreationOptional<Team>

    /**
     * 客队id
     */
    @ForeignKey(() => Team)
    @Column(DataType.INTEGER)
    declare team2_id: number

    @BelongsTo(() => Match, 'team2_id')
    declare team2: CreationOptional<Team>

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

    @Column(DataType.INTEGER)
    declare score1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare score2: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare score1_period1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare score2_period1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner2: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner1_period1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner2_period1: CreationOptional<number>

    @Column(DataType.BOOLEAN)
    declare has_score: CreationOptional<boolean>
}
