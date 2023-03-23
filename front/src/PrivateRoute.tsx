import { Navigate } from 'react-router-dom';
import React, { ReactNode, useEffect, useState } from 'react';
import axios from 'axios';

interface PrivateRouteProps {
	children: ReactNode;
	check2fa?: boolean;
	checkconf?: boolean;
}

async function isAuthenticated() {
	try {
		const response = await axios.get('http://localhost:3333/auth/verify', {
			withCredentials: true,
		});
		if (response.data === 'OK') return true;
		return false;
	} catch (error) {
		return false;
	}
}

async function isConfigurated() {
	try {
		const response = await axios.get('http://localhost:3333/users/me', {
			withCredentials: true,
		});
		if (response.data.avatar !== null) return true;
		return false;
	} catch (error) {
		return false;
	}
}

async function is2FAconf() {
	try {
		const response = await axios.get('http://localhost:3333/users/me', {
			withCredentials: true,
		});
		if (response.data.twoFactor === true) return true;
		return false;
	} catch (error) {
		return false;
	}
}

function PrivateRoute({ children }: PrivateRouteProps) {
	const [isAuth, setIsAuth] = useState<boolean>();
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function checkAuth() {
			const auth = await isAuthenticated();
			setIsAuth(auth);
			setIsLoading(false);
		}
		checkAuth();
	}, []);

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (isAuth === undefined || isAuth === false) {
		return <Navigate to="/login" replace />;
	}
	return children as JSX.Element;
}

export default PrivateRoute;
