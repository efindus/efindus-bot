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

export interface PlayerObject {
	/** Currently played video */ nowPlaying: QueueVideo,
	/** Queue of upcoming videos */ queue: QueueVideo[],
	/** 0 -> no loop; 1 -> single video loop; 2 -> queue loop */ loopType: 0 | 1 | 2,
	/** Current volume; 1 - 100%, .5 - 50% */ volume: number,
	/** AudioPlayer instance for current server */ player: import('@discordjs/voice').AudioPlayer,
	/** AudioResource instance for currently played video */ resource: import('@discordjs/voice').AudioResource,
	/** VoiceConnection instance for current server */ connection: import('@discordjs/voice').VoiceConnection,
	/** ID of the VC the bot is connected to */ channelId: string,
	/** Indicates whether leaving was intended by the bot */ leaving: boolean,
	/** Timeout object for autoleaving the VC */ autoleaveTimeout: NodeJS.Timeout,
	/** 0 - autoleave wasn't delayed; 1 - autoleave was delayed but bot didn't react yet; 2 - indicates that autoleave was delayed and that it got acknowledged */ delayedAutoleave: 0 | 1 | 2,
};
