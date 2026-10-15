// =========================================================================
// KHAI BÁO HÀM CHUYỂN BÀI TIÊU CHUẨN LÊN ĐẦU FILE - SỬA SẠCH LỖI HỆ THỐNG
// =========================================================================
function handleIframeAutoNext() {
    if (isTrackChanging || currentTrackIndex === -1) return;
    executeNextTrackLogic();
}

function nextTrack() { 
    executeNextTrackLogic(); 
}

function prevTrack() {
    if (masterFlatSongsList.length === 0) return;
    var prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) prevIndex = masterFlatSongsList.length - 1;
    playTrack(prevIndex, true, true); 
}

// Cấu hình đường dẫn danh sách file JSON trong thư mục json1
var PLAYLIST_FILES = [
    'a1/json/1.json', 
    'a1/json/2.json', 
    'a1/json/3.json', 
    'a1/json/4.json'
]; 

// CẤU HÌNH SỐ LƯỢNG BÀI HÁT TRÊN MỖI TRANG
var SONGS_PER_PAGE = 100;

// Kho lưu trữ gốc cố định bảo toàn dữ liệu 100%
var masterPlaylistData = {}; 
var masterFlatSongsList = []; 

// Biến hoạt động động dành riêng cho giao diện hiển thị
var playlistData = {}; 
var flatSongsList = []; 
var currentTrackIndex = -1; 
var isTrackChanging = false; 

// Lưu trữ trạng thái trang hiện tại của từng thư mục
var folderPages = {};

// SỬA ĐỔI CHÍNH: Thay đổi mặc định ban đầu luôn luôn là FALSE (Auto Ẩn sẵn khi mới vào trang)
var showSongCount = localStorage.getItem('drive_player_show_count') === 'true';

var favoriteIds = JSON.parse(localStorage.getItem('drive_player_favorites')) || [];

var player = document.getElementById('audio-player');
var titleElement = document.getElementById('song-title');
var wrapperElement = document.getElementById('playlist-wrapper');
var statusElement = document.getElementById('status-msg');

// =========================================================================
// CẤU HÌNH NHẠC NỀN CHẠY ẨN ĐỘC LẬP - XOAY VÒNG, LƯU TRẠNG THÁI & ÂM LƯỢNG
// =========================================================================
var BG_SONGS = [
    "https://netlify.app",
    "https://netlify.app",
    "https://netlify.app",
    "https://netlify.app"
];
var currentBgIndex = 0;
var isBgMusicPlaying = localStorage.getItem('drive_player_bg_playing') !== 'false';

var bgAudio = document.getElementById('bg-audio');
var bgMusicBtn = document.getElementById('bg-music-btn');
var bgVolumeSlider = document.getElementById('bg-volume-slider');

function playBgTrack(index) {
    if (!bgAudio || BG_SONGS.length === 0) return;
    currentBgIndex = index;
    bgAudio.src = BG_SONGS[currentBgIndex];
    
    var savedVolume = localStorage.getItem('drive_player_bg_volume');
    if (savedVolume !== null) {
        bgAudio.volume = parseFloat(savedVolume);
        if (bgVolumeSlider) bgVolumeSlider.value = savedVolume;
    } else {
        bgAudio.volume = 0.1;
        if (bgVolumeSlider) bgVolumeSlider.value = 0.1;
    }

    if (isBgMusicPlaying) {
        bgAudio.play().catch(function(err) { console.log("Chờ người dùng tương tác để phát nhạc nền"); });
    }
}

if (bgAudio) {
    bgAudio.onended = function() {
        var nextBgIndex = currentBgIndex + 1;
        if (nextBgIndex >= BG_SONGS.length) nextBgIndex = 0;
        playBgTrack(nextBgIndex);
    };
}

if (bgVolumeSlider && bgAudio) {
    bgVolumeSlider.oninput = function(e) {
        var volumeVal = e.target.value;
        bgAudio.volume = volumeVal;
        localStorage.setItem('drive_player_bg_volume', volumeVal);
    };
}

function initBgMusicUI() {
    if (!bgMusicBtn) return;
    var statusText = bgMusicBtn.querySelector('.bg-music-status');
    
    if (isBgMusicPlaying) {
        bgMusicBtn.classList.add('playing');
        if (statusText) statusText.innerText = "🎵 Nhạc nền: Đang Bật";
        
        var forcePlayOnInteraction = function() {
            if (isBgMusicPlaying && bgAudio.paused) {
                bgAudio.play().catch(function(err) { console.log("Nhạc nền kích hoạt."); });
            }
            document.removeEventListener('click', forcePlayOnInteraction);
        };
        document.addEventListener('click', forcePlayOnInteraction);
    } else {
        bgMusicBtn.classList.remove('playing');
        if (statusText) statusText.innerText = "🎵 Nhạc nền: Đang Tắt";
    }
}

if (bgMusicBtn && bgAudio) {
    bgMusicBtn.onclick = function() {
        var statusText = bgMusicBtn.querySelector('.bg-music-status');
        if (isBgMusicPlaying) {
            bgAudio.pause();
            isBgMusicPlaying = false;
            localStorage.setItem('drive_player_bg_playing', 'false');
            bgMusicBtn.classList.remove('playing');
            if (statusText) statusText.innerText = "🎵 Nhạc nền: Đang Tắt";
        } else {
            isBgMusicPlaying = true;
            localStorage.setItem('drive_player_bg_playing', 'true');
            if (!bgAudio.src) playBgTrack(0);
            bgAudio.play().catch(function(err) { console.log("Không thể phát nhạc nền:", err); });
            bgMusicBtn.classList.add('playing');
            if (statusText) statusText.innerText = "🎵 Nhạc nền: Đang Bật";
        }
    };
}

// =========================================================================
// LOGIC HỆ THỐNG PHÁT NHẠC CHÍNH TỪ GOOGLE DRIVE PHÍA DƯỚI
// =========================================================================

function cleanSongName(name) {
    if (!name) return "";
    var cleaned = name.trim();
    if (cleaned.toLowerCase().endsWith('.mp3')) {
        cleaned = cleaned.slice(0, -4).trim();
    }
    while (cleaned.endsWith(',') || cleaned.endsWith(' ') || cleaned.endsWith('.') || cleaned.endsWith('_') || cleaned.endsWith('-')) {
        cleaned = cleaned.slice(0, -1).trim();
    }
    return cleaned;
}

function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỉ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function setRandomBackground() {
    var backgrounds = ['bg1.jpg', 'bg2.jpg', 'bg3.jpg', 'bg4.jpg', 'bg5.jpg'];
    var randomIndex = Math.floor(Math.random() * backgrounds.length);
    var selectedBg = backgrounds[randomIndex];
    if (document.body) {
        document.body.style.backgroundImage = "url('" + selectedBg + "')";
    }
}

// NẠP SONG SONG ĐA FILE TỐI ƯU BỘ NHỚ RAM
async function fetchLocalPlaylist() {
    setRandomBackground();
    if (statusElement) statusElement.innerText = "Đang nạp danh sách nhạc từ hệ thống...";
    
    try {
        masterPlaylistData = {};
        masterFlatSongsList = [];
        folderPages = {}; 
        
        var folderCount = 0;
        var seenSongIds = new Set(); 

        var fetchPromises = PLAYLIST_FILES.map(async function(fileName) {
            try {
                var response = await fetch(fileName);
                if (!response.ok) return null;
                return await response.json();
            } catch (err) {
                console.error("Lỗi nạp file dữ liệu: " + fileName, err);
                return null;
            }
        });

        var allPlaylistsResults = await Promise.all(fetchPromises);

        allPlaylistsResults.forEach(function(localData) {
            if (!localData) return;

            for (var folderName in localData) {
                var songs = localData[folderName];
                if (songs && songs.length > 0) {
                    if (!masterPlaylistData[folderName]) {
                        masterPlaylistData[folderName] = [];
                        folderCount++;
                        folderPages[folderName] = 1; 
                    }
                    
                    songs.forEach(function(song) {
                        if (!seenSongIds.has(song.id)) {
                            seenSongIds.add(song.id);
                            masterPlaylistData[folderName].push(song);
                            masterFlatSongsList.push(song);
                        }
                    });
                }
            }
        });

        playlistData = {};
        for (var fName in masterPlaylistData) {
            playlistData[fName] = masterPlaylistData[fName].slice();
        }
        flatSongsList = masterFlatSongsList.slice();

        if (flatSongsList.length === 0) {
            if (statusElement) statusElement.innerText = "Không tìm thấy dữ liệu bài hát.";
            return;
        }

        if (statusElement) statusElement.innerText = "";
        
        // Khởi dựng văn bản đồng bộ lên ô Counter-dashboard tổng
        updateGlobalCountUI(folderCount);
        
        renderGroupedPlaylist(playlistData);
        restoreLastPlayedTrack();

        playBgTrack(0);
        initBgMusicUI();

    } catch (error) {
        if (statusElement) statusElement.innerText = "Lỗi hệ thống khởi tạo: " + error.message;
    }
}

function borderReset() {
    if (!wrapperElement) return;
    var lists = wrapperElement.getElementsByTagName('li');
    for (var i = 0; i < lists.length; i++) {
        lists[i].classList.remove('active');
        var oldWave = lists[i].querySelector('.wave-container');
        if (oldWave) oldWave.remove();
    }
}

// THANH PHÂN TRANG LỒNG VÀO TRONG THỂ <ul> GIÚP GIỮ NGUYÊN CẤU TRÚC KỀ CẠNH CHO CSS GỐC KHỚP TOÁN TỬ "+"
function createFolderDOM(folderName, songs, isFavSection) {
    var titleDiv = document.createElement('div');
    titleDiv.className = isFavSection ? 'folder-section-title favorites-heading' : 'folder-section-title collapsed'; 
    titleDiv.setAttribute('data-name', folderName); 
    
    // Tách biệt chữ số lượng dựa trên cấu trúc showSongCount công tắc
if (showSongCount) {
var formattedCount = songs.length.toLocaleString('en-US');
titleDiv.innerText = folderName + " (" + formattedCount + " bài)";
} else {
titleDiv.innerText = folderName;
}
wrapperElement.appendChild(titleDiv);
var ul = document.createElement('ul');
ul.className = 'playlist';
ul.setAttribute('data-folder-name', folderName);
titleDiv.onclick = function() { titleDiv.classList.toggle('collapsed'); };
var currentPage = folderPages[folderName] || 1;
var totalPages = Math.ceil(songs.length / SONGS_PER_PAGE);
if (!isFavSection && totalPages > 1) {
var liPagination = document.createElement('li');
liPagination.className = 'pagination-row';
liPagination.style.cssText = "display:flex; flex-wrap:wrap; gap:5px; padding:10px 15px; background:rgba(255,255,255,0.4); border-bottom:1px solid #eee; cursor:default; pointer-events:auto;";
liPagination.onclick = function(e) { e.stopPropagation(); };
var label = document.createElement('span');
label.innerText = "Chọn trang:";
label.style.cssText = "color:#666; font-weight:bold; align-self:center; margin-right:5px; font-size:11px;";
liPagination.appendChild(label);
var createPageClick = function(pNumber) {
return function(e) {
e.stopPropagation();
folderPages[folderName] = pNumber;
var expandedNames = [];
wrapperElement.querySelectorAll('.folder-section-title:not(.collapsed)').forEach(function(el) {
var attrName = el.getAttribute('data-name');
if (attrName) expandedNames.push(attrName);
});
renderGroupedPlaylist(playlistData);
wrapperElement.querySelectorAll('.folder-section-title').forEach(function(el) {
var attrName = el.getAttribute('data-name');
if (expandedNames.includes(attrName) || attrName === folderName) {
el.classList.remove('collapsed');
}
});
};
};
for (var p = 1; p <= totalPages; p++) {
var pageBtn = document.createElement('button');
pageBtn.innerText = p;
pageBtn.style.cssText = "border:1px solid #ccc; padding:3px 8px; border-radius:12px; cursor:pointer; font-weight:bold; font-size:11px; transition:all 0.2s;";
if (p === currentPage) {
pageBtn.style.background = "#2196f3";
pageBtn.style.color = "#fff";
pageBtn.style.borderColor = "#2196f3";
} else {
pageBtn.style.background = "rgba(255,255,255,0.7)";
pageBtn.style.color = "#1565c0";
}
pageBtn.onclick = createPageClick(p);
liPagination.appendChild(pageBtn);
}
ul.appendChild(liPagination);
}
var songsToRender = songs;
if (!isFavSection && totalPages > 1) {
var startIndex = (currentPage - 1) * SONGS_PER_PAGE;
var endIndex = startIndex + SONGS_PER_PAGE;
songsToRender = songs.slice(startIndex, endIndex);
}
var fragment = document.createDocumentFragment();
songsToRender.forEach(function(song) {
var li = document.createElement('li');
li.setAttribute('id', (isFavSection ? 'fav-' : 'song-') + song.id);
var textSpan = document.createElement('span');
textSpan.innerText = cleanSongName(song.name);
li.appendChild(textSpan);
var heartSpan = document.createElement('span');
heartSpan.className = 'fav-heart';
heartSpan.innerText = '♥';
if (favoriteIds.includes(song.id)) heartSpan.classList.add('active');
heartSpan.onclick = function(e) {
e.stopPropagation();
toggleFavorite(song.id, heartSpan);
};
li.appendChild(heartSpan);
li.onclick = function() {
var globalIndex = masterFlatSongsList.findIndex(function(s) { return s.id === song.id; });
playTrack(globalIndex, true, false);
};
fragment.appendChild(li);
});
ul.appendChild(fragment);
wrapperElement.appendChild(ul);
}
function renderGroupedPlaylist(groupedData) {
if (!wrapperElement) return;
wrapperElement.innerHTML = '';
var favoriteSongs = masterFlatSongsList.filter(function(song) {
return favoriteIds.includes(song.id);
});
if (favoriteSongs.length > 0) {
createFolderDOM("💖 Bài Hát Yêu Thích", favoriteSongs, true);
}
for (var folderName in groupedData) {
var songs = groupedData[folderName];
if (songs.length === 0) continue;
createFolderDOM(folderName, songs, false);
}
if (currentTrackIndex !== -1) highlightCurrentSong();
}
function toggleFavorite(songId, heartElement) {
var index = favoriteIds.indexOf(songId);
if (index > -1) {
favoriteIds.splice(index, 1);
heartElement.classList.remove('active');
} else {
favoriteIds.push(songId);
heartElement.classList.add('active');
}
localStorage.setItem('drive_player_favorites', JSON.stringify(favoriteIds));
playlistData = {};
for (var fName in masterPlaylistData) {
playlistData[fName] = masterPlaylistData[fName].slice();
}
renderGroupedPlaylist(playlistData);
}
function playTrack(index, autoPlay, isNextPrevAction) {
if (index < 0 || index >= masterFlatSongsList.length || !player) return;
isTrackChanging = true;
currentTrackIndex = index;
var currentSong = masterFlatSongsList[currentTrackIndex];
var currentFolderName = "Danh mục nhạc";
for (var folder in masterPlaylistData) {
var found = masterPlaylistData[folder].some(function(s) { return s.id === currentSong.id; });
if (found) {
currentFolderName = folder;
break;
}
}
if (statusElement) statusElement.innerText = currentFolderName;
if (titleElement) titleElement.innerText = cleanSongName(currentSong.name);
var p1 = "https://", p2 = "drive.", p3 = "google.com", p4 = "/file/d/";
var p5 = "/preview?autoplay=" + (autoPlay ? "1" : "0");
var embedUrl = p1 + p2 + p3 + p4 + currentSong.id + p5;
player.removeAttribute('src');
player.src = embedUrl;
highlightCurrentSong();
localStorage.setItem('drive_player_last_track_id', currentSong.id);
if (isNextPrevAction) {
syncPageAndExpandFolder(currentSong.id, currentFolderName);
setTimeout(function() {
var activeLi = document.getElementById('song-' + currentSong.id) || document.getElementById('fav-' + currentSong.id);
if (activeLi) {
activeLi.scrollIntoView({
behavior: 'smooth',
block: 'center'
});
}
}, 250);
} else {
window.scrollTo({
top: 0,
behavior: 'smooth'
});
}
setTimeout(function() { isTrackChanging = false; }, 3000);
}
function executeNextTrackLogic() {
if (masterFlatSongsList.length === 0) return;
var nextIndex = currentTrackIndex + 1;
if (nextIndex >= masterFlatSongsList.length) nextIndex = 0;
playTrack(nextIndex, true, true);
}
function restoreLastPlayedTrack() {
var lastTrackId = localStorage.getItem('drive_player_last_track_id');
if (lastTrackId) {
var savedIndex = masterFlatSongsList.findIndex(function(s) { return s.id === lastTrackId; });
if (savedIndex !== -1) playTrack(savedIndex, false, true);
}
}
function filterSongs() {
var searchInput = document.getElementById('search-input');
if (!searchInput) return;
var rawKeyword = searchInput.value.toLowerCase().trim();
var keyword = removeVietnameseTones(rawKeyword);
var filteredData = {};
for (var folderName in masterPlaylistData) {
var filteredSongs = masterPlaylistData[folderName].filter(function(song) {
var songNameNoTone = removeVietnameseTones(song.name.toLowerCase());
return songNameNoTone.includes(keyword);
});
if (filteredSongs.length > 0) {
filteredData[folderName] = filteredSongs;
folderPages[folderName] = 1;
}
}
playlistData = filteredData;
renderGroupedPlaylist(playlistData);
}
function highlightCurrentSong() {
borderReset();
var currentSong = masterFlatSongsList[currentTrackIndex];
if (currentSong) {
var activeLiNormal = document.getElementById('song-' + currentSong.id);
var activeLiFav = document.getElementById('fav-' + currentSong.id);
var createWaveDOM = function() {
var waveDiv = document.createElement('div');
waveDiv.className = 'wave-container';
for (var i = 0; i < 4; i++) {
var bar = document.createElement('span');
bar.className = 'wave-bar';
waveDiv.appendChild(bar);
}
return waveDiv;
};
if (activeLiNormal) {
activeLiNormal.classList.add('active');
var heartN = activeLiNormal.querySelector('.fav-heart');
if (heartN) activeLiNormal.insertBefore(createWaveDOM(), heartN);
}
if (activeLiFav) {
activeLiFav.classList.add('active');
var heartF = activeLiFav.querySelector('.fav-heart');
if (heartF) activeLiFav.insertBefore(createWaveDOM(), heartF);
}
}
}
function syncPageAndExpandFolder(songId, folderName) {
var songsInFolder = masterPlaylistData[folderName];
if (!songsInFolder) return;
var songIndexInFolder = songsInFolder.findIndex(function(s) { return s.id === songId; });
if (songIndexInFolder !== -1) {
var targetPage = Math.floor(songIndexInFolder / SONGS_PER_PAGE) + 1;
if (folderPages[folderName] !== targetPage) {
folderPages[folderName] = targetPage;
var expandedNames = [];
wrapperElement.querySelectorAll('.folder-section-title:not(.collapsed)').forEach(function(el) {
var attrName = el.getAttribute('data-name');
if (attrName) expandedNames.push(attrName);
});
renderGroupedPlaylist(playlistData);
wrapperElement.querySelectorAll('.folder-section-title').forEach(function(el) {
var attrName = el.getAttribute('data-name');
if (expandedNames.includes(attrName) || attrName === folderName) {
el.classList.remove('collapsed');
}
});
}
}
var targetUl = wrapperElement.querySelector('ul[data-folder-name="' + folderName + '"]');
if (targetUl) {
var titleDiv = targetUl.previousElementSibling;
if (titleDiv && titleDiv.classList.contains('folder-section-title')) {
titleDiv.classList.remove('collapsed');
}
}
}
// =========================================================================
// CHỨC NĂNG CLICK TRỰC TIẾP VÀO DASHBOARD ĐỂ ẨN/HIỆN TOÀN CỤC
// =========================================================================
function toggleSongCountDisplay() {
showSongCount = !showSongCount;
localStorage.setItem('drive_player_show_count', showSongCount ? 'true' : 'false');
var currentFolderCount = 0;
if (masterPlaylistData) {
currentFolderCount = Object.keys(masterPlaylistData).length;
}
updateGlobalCountUI(currentFolderCount);
var expandedNames = [];
wrapperElement.querySelectorAll('.folder-section-title:not(.collapsed)').forEach(function(el) {
var attrName = el.getAttribute('data-name');
if (attrName) expandedNames.push(attrName);
});
renderGroupedPlaylist(playlistData);
wrapperElement.querySelectorAll('.folder-section-title').forEach(function(el) {
var attrName = el.getAttribute('data-name');
if (expandedNames.includes(attrName)) {
el.classList.remove('collapsed');
}
});
}
function updateGlobalCountUI(fCount) {
var totalFoldersEl = document.getElementById('total-folders');
var totalSongsEl = document.getElementById('total-songs');
if (totalFoldersEl) {
totalFoldersEl.innerText = fCount;
}
if (totalSongsEl) {
if (showSongCount && masterFlatSongsList && masterFlatSongsList.length > 0) {
totalSongsEl.innerText = masterFlatSongsList.length.toLocaleString('en-US') + " bài";
} else {
totalSongsEl.innerText = "Đang ẩn";
}
}
}
window.onload = fetchLocalPlaylist;