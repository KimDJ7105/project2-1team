// server/src/config/configLoader.ts
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// 불러올 설정값들의 타입을 정의
export interface DatabaseConfig {
  type: 'memory' | 'mysql'; // 사용할 DB 종류 
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface AppConfig { // 환경 데이터
  env: string;
  database: DatabaseConfig;
}

// YAML 전체를 담기 위한 타입 정의
interface RawYamlConfig {
  development: AppConfig;
  production: AppConfig;
}

// 1. NODE_ENV 환경 변수를 확인 (기본값은 development)
const env = process.env.NODE_ENV || 'development';

// 2. application.yaml 파일의 절대 경로를 계산
const configPath = path.join(process.cwd(), 'src', 'config', 'application.yaml');

// 3. 파일을 동기식으로 읽기
const fileContents = fs.readFileSync(configPath, 'utf8');

// 4. 문자열을 JavaScript 객체로 파싱
const allConfigs = yaml.load(fileContents) as RawYamlConfig;

// 5. development 혹은 production에 알맞은 설정 뽑아내기
const activeConfig: AppConfig = allConfigs[env as keyof RawYamlConfig] || allConfigs.development;

// 테스트용 로그
console.log(`[Config] 현재 활성화된 환경 설정 프로필: ${env.toUpperCase()}`);
console.log(`[Config] 데이터베이스 타입: ${activeConfig.database.type}`);

export default activeConfig; 