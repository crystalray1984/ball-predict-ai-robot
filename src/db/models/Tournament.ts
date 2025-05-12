import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript'

/**
 * 联赛表
 */
@Table({ tableName: 'tournament', timestamps: false })
export class Tournament extends Model<
    InferAttributes<Tournament>,
    InferCreationAttributes<Tournament>
> {
    /**
     * 联赛id
     */
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: CreationOptional<number>

    /**
     * 皇冠联赛id
     */
    @Column(DataType.STRING)
    declare crown_tournament_id: string

    /**
     * 联赛名称
     */
    @Column(DataType.STRING)
    declare name: string
}
