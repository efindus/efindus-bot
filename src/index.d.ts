export interface QueueVideo {
	/** ID of the video */ id: string,
	/** Title of the video */ title: string,
	/** Name of the channel that uploaded the video */ author: string,
	/** Duration of the video in miliseconds */ duration: number,
};

export interface PlaylistResult {
	/** ID of the playlist */ id: string,
	/** Title of the playlist */ title: string,
	/** Name of the channel that created the playlist */ author: string,
	/** URL for the thumbnail of the playlist */ thumbnailURL: string,
	/** List of videos in the playlist */ videos: QueueVideo[],
};
