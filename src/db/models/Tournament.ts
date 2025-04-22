import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import { Column, CreatedAt, DataType, Model, Table, UpdatedAt } from 'sequelize-typescript'

/**
 * 赛事表
 */
@Table({ tableName: 'tournament' })
export class Tournament extends Model<
    InferAttributes<Tournament>,
    InferCreationAttributes<Tournament>
> {
    /**
     * 赛事id
     */
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
    })
    declare id: CreationOptional<number>

    /**
     * 皇冠赛事id
     */
    @Column(DataType.INTEGER)
    declare crown_tournament_id: number

    /**
     * 赛事名称
     */
    @Column(DataType.STRING(100))
    declare name: string

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
}
