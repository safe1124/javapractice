const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const YouTube = require('youtube-sr').default;

class MusicPlayer {
  constructor() {
    this.queues = new Map(); // guildId -> queue
    this.metadataCache = new Map(); // URL -> metadata cache
  }

  // メタデータキャッシュを設定
  setMetadataCache(cache) {
    Object.entries(cache).forEach(([url, metadata]) => {
      this.metadataCache.set(url, metadata);
    });
  }

  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        songs: [],
        connection: null,
        player: null,
        isPlaying: false,
        volume: 0.5,
        textChannel: null
      });
    }
    return this.queues.get(guildId);
  }

  async play(interaction) {
    const queue = this.getQueue(interaction.guildId);

    if (queue.songs.length === 0) {
      queue.isPlaying = false;
      return;
    }

    const song = queue.songs[0];
    queue.isPlaying = true;

    try {
      // yt-dlp를 사용하여 오디오 스트림 생성
      const process = spawn('yt-dlp', [
        '-f', 'bestaudio',
        '-o', '-',
        '--no-playlist',
        '--quiet',
        song.url
      ]);

      const resource = createAudioResource(process.stdout, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
      });

      resource.volume.setVolume(queue.volume);

      queue.player.play(resource);

      queue.player.once(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        if (queue.songs.length > 0) {
          this.play(interaction);
        } else {
          queue.isPlaying = false;
          if (queue.textChannel) {
            queue.textChannel.send('🎵 재생 목록이 끝났습니다!');
          }
        }
      });

      queue.player.on('error', error => {
        console.error('Player error:', error);
        queue.songs.shift();
        if (queue.songs.length > 0) {
          this.play(interaction);
        }
      });

    } catch (error) {
      console.error('Play error:', error);
      queue.songs.shift();
      if (queue.songs.length > 0) {
        this.play(interaction);
      }
    }
  }

  async addSong(interaction, query) {
    const queue = this.getQueue(interaction.guildId);
    queue.textChannel = interaction.channel;

    let song;

    try {
      let songInfo;

      // YouTube URL인지 확인
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        // キャッシュを確認
        if (this.metadataCache.has(query)) {
          console.log('🚀 キャッシュからメタデータを取得:', query);
          const cached = this.metadataCache.get(query);
          songInfo = {
            title: cached.title,
            url: query,
            duration: cached.duration,
            thumbnail: cached.thumbnail
          };
        } else {
          // キャッシュにない場合はyt-dlpで情報取得
          console.log('⏳ yt-dlpでメタデータを取得:', query);
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execPromise = promisify(exec);

          const { stdout } = await execPromise(`yt-dlp --print "%(title)s|%(duration)s|%(thumbnail)s" "${query}"`);
          const [title, duration, thumbnail] = stdout.trim().split('|');

          songInfo = {
            title: title,
            url: query,
            duration: parseInt(duration),
            thumbnail: thumbnail
          };
        }
      } else {
        // 검색어로 처리
        const searchResults = await YouTube.search(query, { limit: 1, type: 'video' });
        if (searchResults.length === 0) {
          await interaction.editReply('검색 결과를 찾을 수 없습니다!');
          return false;
        }

        const video = searchResults[0];
        songInfo = {
          title: video.title,
          url: video.url,
          duration: video.duration / 1000, // 밀리초를 초로 변환
          thumbnail: video.thumbnail?.url
        };
      }

      song = {
        title: songInfo.title,
        url: songInfo.url,
        duration: songInfo.duration,
        thumbnail: songInfo.thumbnail,
        requestedBy: interaction.user
      };

      queue.songs.push(song);
    } catch (error) {
      console.error('Add song error:', error);
      await interaction.editReply('음악 정보를 가져오는데 실패했습니다!');
      return false;
    }

    // 음성 채널 연결
    if (!queue.connection) {
      const voiceChannel = interaction.member.voice.channel;

      queue.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      queue.player = createAudioPlayer();
      queue.connection.subscribe(queue.player);

      queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(queue.connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(queue.connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
        } catch {
          queue.connection.destroy();
          this.queues.delete(interaction.guildId);
        }
      });
    }

    return song;
  }

  skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player && queue.isPlaying) {
      queue.player.stop();
      return true;
    }
    return false;
  }

  pause(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player && queue.isPlaying) {
      queue.player.pause();
      return true;
    }
    return false;
  }

  resume(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      queue.player.unpause();
      return true;
    }
    return false;
  }

  stop(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.connection) {
      queue.songs = [];
      queue.player.stop();
      queue.connection.destroy();
      this.queues.delete(guildId);
      return true;
    }
    return false;
  }

  getQueueInfo(guildId) {
    return this.getQueue(guildId);
  }

  setVolume(guildId, volume) {
    const queue = this.getQueue(guildId);
    queue.volume = Math.max(0, Math.min(1, volume));
    return queue.volume;
  }
}

module.exports = new MusicPlayer();
