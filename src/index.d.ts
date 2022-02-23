export interface QueueVideo {
	/** ID of the video */ id: string,
	/** Title of the video */ title: string,
	/** Name of the channel that uploaded the video */ author: string,
	/** Duration of the video in miliseconds */ duration: number,
};

export interface SearchPlaylist {
	id: string,
	title: string,
	author: string,
	thumbnailURL: string,
	videos: QueueVideo[],
};
