export interface FilterButtonProps {
	label: string;
	options: string[];
	onFilter: (option: string) => void;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	toggleDropdown: () => void;
	resetFilter: boolean;
}

export interface DataTable {
	gameMode: string;
	team: { img: string; level: number }[];
	date: string;
	hour: string;
	score: number[];
	difficulty: string;
	map: string;
	watch: string;
}

export interface MatchesInProgressProps {
	filters: {
		sortBy: string;
		gameMode: string;
		friends: string;
		map: string;
		difficulty: string;
	};
	viewMoreButton: boolean;
}

export type Filters = {
	sortBy: string;
	gameMode: string;
	friends: string;
	difficulty: string;
	map: string;
};
