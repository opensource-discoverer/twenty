import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { GraphQLModule } from '@nestjs/graphql';
import { DevtoolsModule } from '@nestjs/devtools-integration';

import { existsSync } from 'fs';
import { join } from 'path';

import { YogaDriverConfig, YogaDriver } from '@graphql-yoga/nestjs';

import { ApiRestModule } from 'src/engine/api/rest/api-rest.module';
import { ModulesModule } from 'src/modules/modules.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { MetadataGraphQLApiModule } from 'src/engine/api/graphql/metadata-graphql-api.module';
import { GraphQLConfigModule } from 'src/engine/api/graphql/graphql-config/graphql-config.module';
import { GraphQLConfigService } from 'src/engine/api/graphql/graphql-config/graphql-config.service';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { WorkspaceCacheVersionModule } from 'src/engine/metadata-modules/workspace-cache-version/workspace-cache-version.module';
import { GraphQLHydrateRequestFromTokenMiddleware } from 'src/engine/middlewares/graphql-hydrate-request-from-token.middleware';

import { CoreEngineModule } from './engine/core-modules/core-engine.module';
import { IntegrationsModule } from './engine/integrations/integrations.module';

@Module({
  imports: [
    // Nest.js devtools, use devtools.nestjs.com to debug
    DevtoolsModule.registerAsync({
      useFactory: (environmentService: EnvironmentService) => ({
        http: environmentService.get('DEBUG_MODE'),
        port: environmentService.get('DEBUG_PORT'),
      }),
      inject: [EnvironmentService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRootAsync<YogaDriverConfig>({
      driver: YogaDriver,
      imports: [CoreEngineModule, GraphQLConfigModule],
      useClass: GraphQLConfigService,
    }),
    // Integrations module, contains all the integrations with other services
    IntegrationsModule,
    // Core engine module, contains all the core modules
    CoreEngineModule,
    // Modules module, contains all business logic modules
    ModulesModule,
    // Needed for the user workspace middleware
    WorkspaceCacheVersionModule,
    // Api modules
    CoreGraphQLApiModule,
    MetadataGraphQLApiModule,
    ApiRestModule,
    // Conditional modules
    ...AppModule.getConditionalModules(),
  ],
})
export class AppModule {
  private static getConditionalModules(): DynamicModule[] {
    const modules: DynamicModule[] = [];
    const frontPath = join(__dirname, '..', 'front');

    if (existsSync(frontPath)) {
      modules.push(
        ServeStaticModule.forRoot({
          rootPath: frontPath,
        }),
      );
    }

    return modules;
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(GraphQLHydrateRequestFromTokenMiddleware)
      .forRoutes({ path: 'graphql', method: RequestMethod.ALL });

    consumer
      .apply(GraphQLHydrateRequestFromTokenMiddleware)
      .forRoutes({ path: 'metadata', method: RequestMethod.ALL });
  }
}
