import { useEffect, useState } from "react";
import "./GamePopUp.css";
import { useNavigate } from "react-router-dom";

const replayAnimations = () => {
	document.getAnimations().forEach((anim: Animation) => {
		if (anim.playState === "idle")
		{
			anim.cancel();
			anim.play();
		}
	});
};
const showPopUp = () => {

	/* Show Pop Up */
	document.querySelector<HTMLElement>(".game-pop-up-main")!.style.display = "block";

	/* Reset animation */
	const ball = document.querySelector<HTMLElement>(".game-pop-up-ball");
	const bg = document.querySelector<HTMLElement>(".game-pop-up-background-blue");
	
	ball?.style.setProperty("animation-duration", "20s");
	bg?.style.setProperty("animation-duration", "20s");
	replayAnimations();

};

const hidePopUp = () => {
	/* Hide Pop Up */
	document.querySelector<HTMLElement>(".game-pop-up-main")!.style.display = "none";

};

const GamePopUp = ({socketQueue}:any) => {

	const navigate = useNavigate();
	const [accept, update_accept] = useState(0)
	
	
	/* Socket Manager */
	useEffect(() => {
		const handleGameState = (data:any) => {
			hidePopUp();
			update_accept(0);
			socketQueue.off("GamePopUpResponse", handleGameState);
			if (data.message === "OK")
				navigate("/game", {state: {...data}});
			
		};

		function handleGamePopUpSetup(data: {message: string}) {  /* data = show or hide*/
			if (data.message === "show")
			{
				showPopUp();
				socketQueue.on("GamePopUpResponse", handleGameState);
			}
			else
			{
				hidePopUp();
				socketQueue.off("GamePopUpResponse", handleGameState);
			}
		}
	
		if (socketQueue && socketQueue.connected !== undefined)
			socketQueue.on("GamePopUpSetup", handleGamePopUpSetup);
	
	}, [socketQueue]);

	/* Aniamtion manager */
	useEffect(() => {
		if (accept === 0 || accept === 2)
			return;
		const ball = document.querySelector<HTMLElement>(".game-pop-up-ball");
		const bg = document.querySelector<HTMLElement>(".game-pop-up-background-blue");
		
		
		ball?.style.setProperty("animation-duration", "1s");
		bg?.style.setProperty("animation-duration", "1s");

		//socket.emit("acceptGame")
	}, [accept]);
		
	/* Button handler */
	const handleAccept = (e:any) => {
		if (accept === 0)
		{
			update_accept(1);
			console.log(socketQueue.id);
			socketQueue.emit("AcceptGame");
		}
	}
	
	const handleDecline = () => {
		if (accept === 0)
		{
			update_accept(2);
			console.log(socketQueue.id);
			socketQueue.emit("DeclineGame");
			hidePopUp();
		}
	}

	return (
	<div className="game-pop-up-main">
		<span className="game-pop-up-background-blue"></span>
		<div className="game-pop-up-board">
			<button className="game-pop-up-button" id="Accept-button" onClick={handleAccept}>Accept</button>
			<button className="game-pop-up-button" id="Decline-button" onClick={handleDecline}>Decline</button>
			<span className="game-pop-up-bar" id="player1-bar-popup"></span>
			<span className="game-pop-up-bar" id="player2-bar-popup"></span>
			<span className="game-pop-up-ball" id="no"></span>
		</div>
	</div>
	)
}

export default GamePopUp; 
