import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProxyThrottlerGuard } from './common/guards/proxy-throttler.guard';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuditModule } from './common/audit/audit.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AuditService } from './common/audit/audit.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { CustomersModule } from './modules/customers/customers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { AiModule } from './modules/ai/ai.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ContentModule } from './modules/content/content.module';
import { FaqModule } from './modules/faq/faq.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyzeModule } from './modules/analyze/analyze.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { RavingFanModule } from './modules/raving-fan/raving-fan.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      // For local dev; in containers/production, env is injected directly.
      envFilePath: ['.env', '../.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: parseInt(process.env.RATE_LIMIT_PER_MIN ?? '120', 10),
      },
    ]),
    PrismaModule,
    CryptoModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    ReturnsModule,
    AiModule,
    DashboardModule,
    ContentModule,
    FaqModule,
    NotificationsModule,
    AnalyzeModule,
    FulfillmentModule,
    WorkflowModule,
    IntegrationsModule,
    RavingFanModule,
    UploadsModule,
    ReportsModule,
    TenantModule,
    ComplianceModule,
    MarketplaceModule,
  ],
  providers: [
    Reflector,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (audit: AuditService) => new AuditInterceptor(audit),
      inject: [AuditService],
    },
    { provide: APP_GUARD, useClass: ProxyThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
