import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { UserModule } from "./user/user.module";
import { JwtModule } from "@nestjs/jwt";
import { FriendModule } from "./friend/friend.module";
import { ChatGateway } from "./chat/chat.gateway";
import { ChatModule } from "./chat/chat.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		AuthModule,
		PrismaModule,
		UserModule,
		JwtModule.register({
			secret: process.env.JWT_SECRET,
			signOptions: { expiresIn: "120min" },
		}),
		FriendModule,
		ChatModule,
	],
	providers: [ChatGateway],
})
export class AppModule {}
