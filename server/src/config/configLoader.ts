import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface ClientConfig {
  url: string;
}

export interface DatabaseConfig {
  type: 'memory' | 'mysql';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface AppConfig {
  env: string;
  client: ClientConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
}

interface RawYamlConfig {
  development: AppConfig;
  production: AppConfig;
}

// ${VAR:default} 형태의 문자열을 실제 process.env 환경변수 또는 기본값으로 치환
function replaceEnvVars(content: string): string {
  return content.replace(/\${(\w+)(?::([^}]*))?}/g, (match: string, envVar: string, defaultValue: string) => {
    const val = process.env[envVar];
    if (val !== undefined && val !== '') {
      return val;
    }
    return defaultValue !== undefined ? defaultValue : match;
  });
}

const env = process.env.NODE_ENV || 'development';
const configPath = path.join(process.cwd(), 'src', 'config', 'application.yaml');

// 1. YAML 파일 동기 읽기
let fileContents = fs.readFileSync(configPath, 'utf8');

// 2. 전체 파일 내용에서 환경변수 표기법(${VAR:default}) 치환
fileContents = replaceEnvVars(fileContents);

// 3. YAML 객체 파싱
const allConfigs = yaml.load(fileContents) as RawYamlConfig;
const activeConfig: AppConfig = allConfigs[env as keyof RawYamlConfig] || allConfigs.development;

console.log(`[Config] 현재 활성화된 환경 설정 프로필: ${env.toUpperCase()}`);
console.log(`[Config] 클라이언트 URL: ${activeConfig.client.url}`);
console.log(`[Config] 데이터베이스 타입: ${activeConfig.database.type}`);
console.log(`[Config] Redis 호스트 주소: ${activeConfig.redis.host}`);

export default activeConfig;