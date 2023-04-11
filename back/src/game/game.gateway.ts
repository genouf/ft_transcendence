import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "src/prisma/prisma.service";
import { SocketUser } from "./dto";
import * as jwt from 'jsonwebtoken'
import { Game, User } from "@prisma/client";
import { GameRoom } from "./class";

@WebSocketGateway({namespace:"game", cors: {origin: "*"}})
export class GameGateway {
	constructor(private prisma: PrismaService) {}
	
	@WebSocketServer()
	server: Server;
	
	ConnectedSockets: SocketUser[] = [];
	GamePlaying : {room: number, specList: string[]}[] = [];

	async sleep(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private getPlayerSocket(room: number) {
		const player1 = this.ConnectedSockets.find((socket) =>
				socket.roomName === "game-" + room
				&& socket.state === "player1");
		const player2 = this.ConnectedSockets.find((socket) =>
			socket.roomName === "game-" + room &&
			socket.state === "player2");
		return ({player1, player2})
	}

	private async moveBall(gameRoom: GameRoom, room: number) {

		let increment_x = gameRoom.ball.speed_x * Math.cos(gameRoom.ball.direction);
		let increment_y = gameRoom.ball.speed_y * Math.sin(gameRoom.ball.direction);
		
		gameRoom.checkBallBounce(increment_x);
		
		gameRoom.incrementBallY(increment_y);

		if (gameRoom.checkBallScore()) {
			await this.prisma.game.update({
				where: { id: room },
				data: { score1: gameRoom.player1.score, score2: gameRoom.player2.score }
			})
		}
	}

	private movePlayer(gameRoom: GameRoom, room: number) {
		let players = this.getPlayerSocket(room);

		gameRoom.updatePlayerPosition(players.player1);
		gameRoom.updatePlayerPosition(players.player2);
	}

	private async waitingPlayerConnection(room: number) {
		while (this.ConnectedSockets.findIndex((socket) => socket.roomName === "game-" + room && socket.state === "player1") === -1 ||
				this.ConnectedSockets.findIndex((socket) => socket.roomName === "game-" + room && socket.state === "player2") === -1) {
				console.log("waiting for player connection");
				await this.sleep(1000); // can add a timeout here --> if timeout, delete the game or make cancel state
		}
		await this.prisma.game.update({
			where: { id: room },
			data: { score1: 0, score2: 0, state: "PLAYING"}
		})
		//faire une animation parce que c'est jolie // probablement du front enfaite
	}

	private checkConnected(room: number) {
		let players = this.getPlayerSocket(room);
		if (players.player1 === undefined && players.player2 === undefined)
			return ({state: true, mode: "disconnected"});
		else if (players.player1 && players.player1.surrender)
			return ({state: true, mode: "surrender", player: 1});
		else if (players.player2 && players.player2.surrender)
			return ({state: true, mode: "surrender", player: 2});
		return ({state: false, mode: "none"});
	}


	private async gameRun(gameRoom: GameRoom, room: number) {
		let end;
		let wait = 0;

		while (true) {
			this.movePlayer(gameRoom, room);
			await this.moveBall(gameRoom, room);
			this.server.to("game-" + room).emit("gameState", gameRoom.getGameRoomInfo());
			end = gameRoom.checkEndGame();
			if (end.state)
				return (end.mode);
			end = this.checkConnected(room);
			if (end.state && end.mode === "disconnected")
			{
				if (wait > 2500)
					return (end);
				else
					wait += 1;
			}
			else if (end.state)
				return (end);
			else
				wait = 0;
			await this.sleep(5)
		}
	}

	private async gameEnd(gameRoom: GameRoom, room: number, endMode: any) {
		await this.prisma.game.update({
			where: { id: room },
			data: { state: "ENDED"}
		})
		const game = await this.prisma.game.findUnique({where: {id: room}});	
		if (!game)
			return (false);

		if (endMode.mode === "normal") {
			if (gameRoom.player1.score > gameRoom.player2.score)
			{
				await this.prisma.game.update({
					where: { id: room },
					data: { winner: game.user1Id }})
				await this.prisma.user.update({
					where: { id: game.user1Id },
					data: { state: "ONLINE", wins: { increment: 1 } }})
				await this.prisma.user.update({
					where: { id: game.user2Id },
					data: { state: "ONLINE", losses: { increment: 1 } }})
			}
			else
			{
				await this.prisma.game.update({
					where: { id: room },
					data: { winner: game.user2Id }})
				await this.prisma.user.update({
					where: { id: game.user2Id },
					data: { state: "ONLINE",wins: { increment: 1 } }})
				await this.prisma.user.update({
					where: { id: game.user1Id },
					data: { state: "ONLINE", losses: { increment: 1 } }})
			}
		}
		else if (endMode.mode === "surrender") {
			if (endMode.player === 2)
			{
				await this.prisma.game.update({
					where: { id: room },
					data: { winner: game.user1Id }})
				await this.prisma.user.update({
					where: { id: game.user1Id },
					data: { state: "ONLINE", wins: { increment: 1 } }})
				await this.prisma.user.update({
					where: { id: game.user2Id },
					data: { state: "ONLINE", losses: { increment: 1 } }})
			}
			else
			{
				await this.prisma.game.update({
					where: { id: room },
					data: { winner: game.user2Id }})
				await this.prisma.user.update({
					where: { id: game.user2Id },
					data: { state: "ONLINE",wins: { increment: 1 } }})
				await this.prisma.user.update({
					where: { id: game.user1Id },
					data: { state: "ONLINE", losses: { increment: 1 } }})
			}
		}
		else if (endMode.mode === "disconnected") {
			await this.prisma.user.update({
				where: { id: game.user2Id },
				data: { state: "ONLINE"}})
			await this.prisma.user.update({
				where: { id: game.user1Id },
				data: { state: "ONLINE"}})

		}
			
		
		// this.GamePlaying.splice(this.GamePlaying.indexOf(room), 1);
		this.GamePlaying.splice(this.GamePlaying.findIndex((game) => game.room === room), 1);
		//disconnect all socket to the room associated and navigate to the end page
		this.server.to("game-" + room).emit("endGame", {player1_score: gameRoom.player1.score, player2_score: gameRoom.player2.score});
		//jE PENSE QU'IL FAUDRAIT AUSSI DELETE ROOM
	}

	async gameLoop(room: number) {
		let gameRoom = new GameRoom(room);

		await this.waitingPlayerConnection(room);

		let end: any = await this.gameRun(gameRoom, room);

		await this.gameEnd(gameRoom, room, end);
	}

	private async checkUserConnection(client: Socket, data: any) {
	
		const cookies = client.handshake.headers.cookie;
		const token = cookies.split("jwt=")[1].split(";")[0];
		const userCookie = JSON.parse(atob(token.split(".")[1]));
	//	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { if (err) return (null); });

		const user = await this.prisma.user.findUnique({where: {login: userCookie.login}});
		if (!user)
			return (null);
		if (!data || !data.room)
			return (null);
		const room = data.room;
		
		const game = await this.prisma.game.findUnique({where: {id: room}});	
		if (!game || game.state == "ENDED")
			return (null);
		return ({login: userCookie.login, user, game, room})
	}

	private addSpecToRoom(room: number, login: string) {
		const game = this.GamePlaying.find(x => x.room === room);
		if (game && game.specList.find(x => x === login) === undefined)
		{
			game.specList.push(login);
			this.server.to("game-" + room).emit("updateSpectator", {spectator: game.specList.length});
		}
	}

	private removeSpecToRoom(room: number, login: string) {
		const game = this.GamePlaying.find(x => x.room === room);
		if (game && game.specList.find(x => x === login) !== undefined)
		{
			game.specList.splice(game.specList.findIndex((spec) => spec === login), 1);
			this.server.to("game-" + room).emit("updateSpectator", {spectator: game.specList.length});
		}
	}

	private setupUserSocket(client: Socket, user: User, game: Game, userLogin: string, room: number) {
		let state : string;

		if (game.user1Id == user.id)
			state = "player1";
		else if (game.user2Id == user.id)
			state = "player2";	
		else
		{
			state = "spectator";
			this.addSpecToRoom(room, user.login);
		}

		const sockUser : SocketUser = this.ConnectedSockets.find(x => x.login === user.login);

		if (sockUser != null)
		{
			if (sockUser.state === "spectator")
				this.removeSpecToRoom(parseInt(sockUser.roomName.split("game-")[0]), sockUser.login);
			if (sockUser.roomName !== "game-" + room)
			{
				sockUser.roomName = "game-" + room;
				sockUser.state = state;
				sockUser.up = 0;
				sockUser.down = 0;
				sockUser.socketId = client.id;

				client.join("game-" + room);
			}
		}
		else
		{
			this.ConnectedSockets.push({
				prismaId: user.id,
				socketId: client.id,
				login: userLogin,
				roomName: "game-" + room,
				state: state,
				up: 0,
				down: 0,
				surrender: false
			});
			client.join("game-" + room);
		}
	}

	private async checkAndSave(client: Socket, data: any) {

		let userCheck = await this.checkUserConnection(client, data);
		
		if (userCheck === null)
		{
			client.emit("error"); 
			return (false);
		}
		
		this.setupUserSocket(client, userCheck.user, userCheck.game, userCheck.login, userCheck.room);
		
		if (userCheck.game.state === "CREATING")// || userCheck.game.state === "PLAYING")
			client.emit("gameState", {
				ball_x: 0.5,
				ball_y: 0.5,
				ball_size: 0.03,
				
				player1_x: 0.006,
				player1_y: 0.5,
				player1_size: 0.2,
				player1_score: 0,
	
				player2_x: 0.994,
				player2_y: 0.5,
				player2_size: 0.2,
				player2_score: 0,
			});
		if (this.GamePlaying.findIndex(x => x.room === userCheck.room) === -1)
		{
			this.GamePlaying.push({room: userCheck.room, specList: []});
			this.gameLoop(userCheck.room);
		}
		return (true);
	}
 
	async handleConnection(client: Socket) {
		console.log("Game Server Connection", client.id);

		return ;
	}

	handleDisconnect(client: Socket) {
		const sockUser : SocketUser = this.ConnectedSockets.find(x => x.socketId === client.id);
		if (sockUser != null)
		{
			client.leave(sockUser.roomName);
			this.ConnectedSockets.splice(this.ConnectedSockets.findIndex(x => x.socketId === client.id), 1);
		}
		return ;
	}

	@SubscribeMessage("gameConnection")
	async handleGameConnection(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
		return await this.checkAndSave(client, data);
	}

	@SubscribeMessage("gameDisconnection")
	async handleGameDisconnection(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
		const sockUser : SocketUser = this.ConnectedSockets.find(x => x.socketId === client.id);
		if (sockUser != null)
		{
			client.leave(sockUser.roomName);
			//this.server.to(client.id).socketsLeave(sockUser.roomName);
			if (sockUser.state === "spectator")
				this.removeSpecToRoom(parseInt(sockUser.roomName.split("game-")[0]), sockUser.login);
			this.ConnectedSockets.splice(this.ConnectedSockets.findIndex(x => x.socketId === client.id), 1);
		}
	}

	@SubscribeMessage("keyPress")
	HandleKeyPress(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
		const sockUser : SocketUser = this.ConnectedSockets.find(x => x.socketId === client.id);
		if (sockUser != null)
		{
			if (data === "UP") {
				sockUser.up = 1;
				if (sockUser.down === 1)
					sockUser.down = 2;
			}
			else if (data === "DOWN") {
				sockUser.down = 1;
				if (sockUser.up === 1)
					sockUser.up = 2;
			}
		}
	}

	@SubscribeMessage("keyRelease")
	HandleKeyRelease(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
		const sockUser : SocketUser = this.ConnectedSockets.find(x => x.socketId === client.id);
		if (sockUser != null)
		{
			if (data === "UP") {
				sockUser.up = 0;
				if (sockUser.down === 2)
					sockUser.down = 1;
			}
			else if (data === "DOWN") {
				sockUser.down = 0;
				if (sockUser.up === 2)
					sockUser.up = 1;
			}
		}
	}

	@SubscribeMessage("surrender")
	HandleSurrender(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
		console.log("surrender: ", data)
		const players = this.getPlayerSocket(data.room);
		
		if (players.player1 != null && players.player1.login === data.login)
			players.player1.surrender = true;
		if (players.player2 != null && players.player2.login === data.login)
			players.player2.surrender = true;
	}

	@SubscribeMessage("quickChatMessage")
	async HandleQuickChatMessage(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
		const sockUser : SocketUser = this.ConnectedSockets.find(x => x.socketId === client.id);
		if (sockUser === null)
			return ;
		
		const game = await this.prisma.game.findUnique({where: {id: data.room}});

		if (game === null || game.state === "ENDED" || (game.user1Id !== sockUser.prismaId && game.user2Id !== sockUser.prismaId))
			return ;

		this.server.to("game-" + data.room).emit("quickChatMessageResponse", {login: sockUser.login, message: parseInt(data.key)});
	}

	@SubscribeMessage("getSpectator")
	HanldeGetSpectator(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
		const sockUser : SocketUser = this.ConnectedSockets.find(x => x.socketId === client.id);
		if (sockUser === null)
			return ;
		
		const game = this.GamePlaying.find(x => x.room === data.room);
		if (game === undefined)
			return ;
		
		client.emit("updateSpectator", {spectator: game.specList.length});
	}
}
