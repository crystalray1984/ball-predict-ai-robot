import { RedisOptions } from 'ioredis'
import { load } from 'js-yaml'
import { merge } from 'lodash'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Options } from 'sequelize'
import { Options as PoolOptions } from 'generic-pool'
import { Options as RabbitmqOptions } from 'amqplib'

/**
 * 当前应用的根目录
 */
const APP_ROOT = resolve(__dirname, '../../')

/**
 * 获取配置文件列表
 */
function getConfigFiles() {
    const files = ['config.yaml', 'config.yaml.local'].map((file) => join(APP_ROOT, file))
    return files.filter((file) => existsSync(file))
}

/**
 * 读取配置文件
 */
function loadConfigFiles(): any {
    let output = {}
    const files = getConfigFiles()
    for (const filePath of files) {
        const config = load(readFileSync(filePath, 'utf-8'))
        if (typeof config === 'object' && config) {
            output = merge(output, config)
        }
    }
    return output
}

/**
 * 应用数据库配置
 */
export type AppDbConfig = Pick<
    Options,
    | 'dialect'
    | 'username'
    | 'password'
    | 'host'
    | 'port'
    | 'database'
    | 'pool'
    | 'timezone'
    | 'dialectOptions'
    | 'schema'
>

/**
 * Redis配置
 */
export interface RedisConfig {
    /**
     * 连接配置
     */
    connection: RedisOptions
    /**
     * 连接池配置
     */
    pool: PoolOptions
}

/**
 * 应用配置
 */
export interface AppConfig {
    /**
     * 数据库配置
     */
    db: AppDbConfig
    /**
     * Redis配置
     */
    redis: RedisConfig
    /**
     * 服务端接口地址
     */
    api_url: string
    /**
     * surebet接口调用凭证
     */
    surebet_token: string
    /**
     * 皇冠首页地址
     */
    crown_url?: string
    /**
     * rabbitmq连接配置项
     */
    rabbitmq: string | RabbitmqOptions.Connect
}

/**
 * 读取配置
 */
export const CONFIG: AppConfig = loadConfigFiles()
