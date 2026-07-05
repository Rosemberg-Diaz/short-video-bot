import fs from "node:fs";
import type { Episode, TopVideo } from "@prisma/client";
import { google, youtube_v3 } from "googleapis";
import { YOUTUBE_UPLOAD_STATUS } from "../config/constants";
import {
  getYouTubeConfig,
  type YouTubeConfig,
  type YouTubePrivacyStatus,
} from "../config/youtube.config";
import { prisma } from "../database/client";
import { LocalAssetCleanupService } from "./local-asset-cleanup.service";
import { YouTubeAuthService } from "./youtube-auth.service";

export type UploadableEpisode = Episode;
export type UploadableTopVideo = TopVideo;

export interface UploadableVideo {
  title: string;
  description: string;
  hashtags: string | string[];
  videoPath: string;
}

export interface UploadedVideoResult {
  videoId: string;
  youtubeUrl: string;
  privacyStatus: YouTubePrivacyStatus;
}

export class YouTubeUploaderService {
  private readonly authService: YouTubeAuthService;
  private readonly cleanupService = new LocalAssetCleanupService();

  constructor(private readonly config: YouTubeConfig = getYouTubeConfig()) {
    this.authService = new YouTubeAuthService(this.config);
  }

  async uploadEpisode(
    episode: UploadableEpisode,
    privacyStatus: YouTubePrivacyStatus = this.config.defaultPrivacyStatus,
  ): Promise<Episode> {
    if (episode.youtubeUploadStatus === YOUTUBE_UPLOAD_STATUS.COMPLETED) {
      throw new Error(
        `El episodio #${episode.id} ya fue subido: ${episode.youtubeUrl}`,
      );
    }
    if (!episode.videoPath) {
      throw new Error(`El episodio #${episode.id} no tiene videoPath.`);
    }
    if (!fs.existsSync(episode.videoPath)) {
      throw new Error(`No existe el video: ${episode.videoPath}`);
    }

    await prisma.episode.update({
      where: { id: episode.id },
      data: {
        youtubeUploadStatus: YOUTUBE_UPLOAD_STATUS.UPLOADING,
        youtubeUploadError: null,
      },
    });

    try {
      const auth = await this.authService.getAuthorizedClient();
      const youtube = google.youtube({ version: "v3", auth });
      const response = await youtube.videos.insert({
        part: ["snippet", "status"],
        notifySubscribers: this.config.notifySubscribers,
        requestBody: this.createVideoResource(
          {
            title: episode.title,
            description: episode.description,
            hashtags: episode.hashtags,
            videoPath: episode.videoPath,
          },
          privacyStatus,
        ),
        media: {
          body: fs.createReadStream(episode.videoPath),
        },
      });

      const videoId = response.data.id;
      if (!videoId) {
        throw new Error("YouTube no devolvio un video ID.");
      }

      const uploaded = await prisma.episode.update({
        where: { id: episode.id },
        data: {
          status: "PUBLISHED",
          youtubeVideoId: videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          youtubeUploadStatus: YOUTUBE_UPLOAD_STATUS.COMPLETED,
          youtubeUploadError: null,
          youtubePrivacyStatus: privacyStatus,
          uploadedAt: new Date(),
        },
      });

      if (this.config.cleanupLocalAssetsAfterUpload) {
        try {
          await this.cleanupService.cleanupEpisodeAssets(uploaded);
        } catch (cleanupError: unknown) {
          const message =
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError);
          console.warn(`La subida fue correcta, pero la limpieza fallo: ${message}`);
        }
      }

      return uploaded;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          youtubeUploadStatus: YOUTUBE_UPLOAD_STATUS.FAILED,
          youtubeUploadError: message.slice(0, 4000),
        },
      });
      throw error;
    }
  }

  async uploadVideo(
    video: UploadableVideo,
    privacyStatus: YouTubePrivacyStatus = this.config.defaultPrivacyStatus,
  ): Promise<UploadedVideoResult> {
    if (!video.videoPath) {
      throw new Error("El video no tiene videoPath.");
    }
    if (!fs.existsSync(video.videoPath)) {
      throw new Error(`No existe el video: ${video.videoPath}`);
    }

    const auth = await this.authService.getAuthorizedClient();
    const youtube = google.youtube({ version: "v3", auth });
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      notifySubscribers: this.config.notifySubscribers,
      requestBody: this.createVideoResource(video, privacyStatus),
      media: {
        body: fs.createReadStream(video.videoPath),
      },
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error("YouTube no devolvio un video ID.");
    }

    return {
      videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      privacyStatus,
    };
  }

  async uploadTopVideo(
    topVideo: UploadableTopVideo,
    privacyStatus: YouTubePrivacyStatus = this.config.defaultPrivacyStatus,
  ): Promise<TopVideo> {
    if (topVideo.youtubeUploadStatus === YOUTUBE_UPLOAD_STATUS.COMPLETED) {
      throw new Error(
        `El top #${topVideo.id} ya fue subido: ${topVideo.youtubeUrl}`,
      );
    }
    if (!topVideo.videoPath) {
      throw new Error(`El top #${topVideo.id} no tiene videoPath.`);
    }
    if (!fs.existsSync(topVideo.videoPath)) {
      throw new Error(`No existe el video: ${topVideo.videoPath}`);
    }

    await prisma.topVideo.update({
      where: { id: topVideo.id },
      data: {
        youtubeUploadStatus: YOUTUBE_UPLOAD_STATUS.UPLOADING,
        youtubeUploadError: null,
      },
    });

    try {
      const uploaded = await this.uploadVideo(
        {
          title: topVideo.title,
          description: topVideo.description,
          hashtags: topVideo.hashtags,
          videoPath: topVideo.videoPath,
        },
        privacyStatus,
      );

      return prisma.topVideo.update({
        where: { id: topVideo.id },
        data: {
          youtubeVideoId: uploaded.videoId,
          youtubeUrl: uploaded.youtubeUrl,
          youtubeUploadStatus: YOUTUBE_UPLOAD_STATUS.COMPLETED,
          youtubeUploadError: null,
          youtubePrivacyStatus: privacyStatus,
          uploadedAt: new Date(),
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.topVideo.update({
        where: { id: topVideo.id },
        data: {
          youtubeUploadStatus: YOUTUBE_UPLOAD_STATUS.FAILED,
          youtubeUploadError: message.slice(0, 4000),
        },
      });
      throw error;
    }
  }

  private createVideoResource(
    video: UploadableVideo,
    privacyStatus: YouTubePrivacyStatus,
  ): youtube_v3.Schema$Video {
    const tags = this.extractTags(video.hashtags);
    const description = this.buildDescription(video);

    return {
      snippet: {
        title: this.truncate(video.title, 100),
        description,
        tags,
        categoryId: this.config.defaultCategoryId,
        defaultLanguage: "es",
        defaultAudioLanguage: "es",
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      } as youtube_v3.Schema$VideoStatus,
    };
  }

  private buildDescription(video: UploadableVideo): string {
    const hashtags = this.extractTags(video.hashtags).map((tag) => `#${tag}`).join(" ");
    return this.truncate(
      [
        video.description,
        "",
        this.config.channel === "viral-tops"
          ? "Top viral generado automaticamente por Short Video Bot."
          : "Short de terror tecnologico generado con AI Horror Shorts Factory.",
        hashtags,
      ]
        .filter(Boolean)
        .join("\n"),
      5000,
    );
  }

  private extractTags(rawHashtags: string | string[]): string[] {
    const raw = Array.isArray(rawHashtags) ? rawHashtags.join(" ") : rawHashtags;
    const tags = raw
      .split(/\s+/u)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.replace(/^#/u, ""))
      .filter((tag, index, all) => all.indexOf(tag) === index);

    if (!tags.includes("Shorts")) tags.push("Shorts");
    return tags.slice(0, 15);
  }

  private truncate(value: string, maxLength: number): string {
    return value.length <= maxLength ? value : value.slice(0, maxLength - 1);
  }
}
