document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const rubiToggle = document.getElementById('rubi-toggle');
    const mainTabs = document.querySelectorAll('.tab');
    const kanjiSubTabsContainer = document.getElementById('kanji-sub-tabs');
    const subTabs = document.querySelectorAll('.sub-tab');
    const pullSlider = document.getElementById('pull-slider');
    const pullCountDisplay = document.getElementById('pull-count-display');
    const gachaBtn = document.getElementById('gacha-btn');
    const resultContainer = document.getElementById('result-container');
    const adSpace = document.getElementById('ad-space');
    const historyList = document.getElementById('history-list');
    const shareBtn = document.getElementById('share-btn');

    // State
    let currentCategory = 'all';
    let currentLevel = 'level1';
    let pullCount = 1;
    let showRubi = true;
    let previousResults = [];
    let currentResults = [];
    
    const DB_CACHE = {
        'all': null,
        'kanji1': null,
        'kanjipre1': null,
        'kanji2': null,
        'creative': null,
        'trivia': null,
        'proverb': null
    };

    // --- イベントリスナー ---

    rubiToggle.addEventListener('change', (e) => {
        showRubi = e.target.checked;
        if (showRubi) {
            resultContainer.classList.remove('hide-rubi');
        } else {
            resultContainer.classList.add('hide-rubi');
        }
        document.querySelectorAll('ruby').forEach(r => r.classList.remove('revealed'));
    });

    pullSlider.addEventListener('input', (e) => {
        pullCount = parseInt(e.target.value, 10);
        pullCountDisplay.textContent = pullCount;
    });

    mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            mainTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;

            if (currentCategory === 'kanji') {
                kanjiSubTabsContainer.classList.remove('hidden');
            } else {
                kanjiSubTabsContainer.classList.add('hidden');
            }
        });
    });

    subTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            subTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentLevel = tab.dataset.level;
        });
    });

    gachaBtn.addEventListener('click', () => {
        rollGacha();
    });

    // --- 動的読み込みロジック ---
    function loadDatabaseScript(filename, variableName) {
        return new Promise((resolve, reject) => {
            if (window[variableName]) {
                resolve(window[variableName]);
                return;
            }
            const script = document.createElement('script');
            script.src = filename;
            script.onload = () => {
                if (window[variableName]) {
                    // カスタム辞書の後入れマージ（全単語と創作タブへ優先追加）
                    if (window.DB_CUSTOM && (variableName === 'DB_ALL' || variableName === 'DB_CREATIVE')) {
                        window[variableName] = window[variableName].concat(window.DB_CUSTOM);
                    }
                    resolve(window[variableName]);
                } else {
                    reject(new Error(`変数 ${variableName} が見つかりません`));
                }
            };
            script.onerror = () => reject(new Error(`ファイル ${filename} の読み込みに失敗しました。最新の辞書をビルダーで出力し、解凍したファイルを同じフォルダに配置してください。`));
            document.body.appendChild(script);
        });
    }

    // --- ロジック実装 ---

    const categoryNames = {
        'creative': '創作',
        'kanji': '難読',
        'trivia': 'カオス',
        'proverb': 'ことわざ',
        'nsfw': '閲覧注意'
    };

    async function rollGacha() {
        let dbKey = currentCategory;
        let scriptFile = '';
        let globalVar = '';

        if (currentCategory === 'kanji') {
            dbKey = currentLevel;
            if (currentLevel === 'level1') { scriptFile = 'db_kanji_1.js'; globalVar = 'DB_KANJI_1'; }
            else if (currentLevel === 'level_pre1') { scriptFile = 'db_kanji_pre1.js'; globalVar = 'DB_KANJI_PRE1'; }
            else if (currentLevel === 'level2') { scriptFile = 'db_kanji_2.js'; globalVar = 'DB_KANJI_2'; }
            else { scriptFile = 'db_kanji_low.js'; globalVar = 'DB_KANJI_LOW'; }
        } else if (currentCategory === 'creative') {
            scriptFile = 'db_creative.js'; globalVar = 'DB_CREATIVE';
        } else if (currentCategory === 'trivia') {
            scriptFile = 'db_trivia.js'; globalVar = 'DB_TRIVIA';
        } else if (currentCategory === 'proverb') {
            scriptFile = 'db_proverb.js'; globalVar = 'DB_PROVERB';
        } else {
            scriptFile = 'db_all.js'; globalVar = 'DB_ALL';
        }

        gachaBtn.disabled = true;
        const originalText = gachaBtn.innerText;
        gachaBtn.innerText = "読み込み中...";

        let targetDB = DB_CACHE[dbKey];
        try {
            if (!targetDB) {
                targetDB = await loadDatabaseScript(scriptFile, globalVar);
                DB_CACHE[dbKey] = targetDB;
            }
        } catch (e) {
            alert(e.message);
            gachaBtn.disabled = false;
            gachaBtn.innerText = originalText;
            return;
        }

        gachaBtn.disabled = false;
        gachaBtn.innerText = originalText;

        if (!targetDB || targetDB.length === 0) return;

        let results = [];

        let filteredWords = targetDB;
        const shuffled = [...filteredWords].sort(() => 0.5 - Math.random());
        results = shuffled.slice(0, Math.min(pullCount, shuffled.length));

        const hasNsfw = results.some(word => word.c.includes('nsfw'));

        previousResults = currentResults;
        currentResults = results;

        renderResults(results);
        updateAdSpace(hasNsfw);
        renderHistory();
        
        if(shareBtn) shareBtn.style.display = 'inline-block';
    }

    function renderResults(results) {
        resultContainer.innerHTML = '';

        results.forEach((item, index) => {
            const displayCat = item.c.find(c => categoryNames[c]) || '';
            const badgeText = categoryNames[displayCat] || '';

            const card = document.createElement('div');
            card.className = 'word-card';
            card.style.animationDelay = `${index * 0.1}s`;

            card.innerHTML = `
                ${badgeText ? `<div class="card-category">${badgeText}</div>` : ''}
                <ruby>
                    ${item.w}
                    <rt>${item.y}</rt>
                </ruby>
            `;

            const rubyEl = card.querySelector('ruby');
            rubyEl.addEventListener('click', () => {
                if (!showRubi) {
                    rubyEl.classList.add('revealed');
                }
            });

            resultContainer.appendChild(card);
        });
    }

    function updateAdSpace(hasNsfw) {
        if (hasNsfw) {
            adSpace.classList.add('hidden');
        } else {
            adSpace.classList.remove('hidden');
        }
    }

    function renderHistory() {
        historyList.innerHTML = '';
        
        if (previousResults.length === 0) {
            return;
        }

        previousResults.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <span class="history-word">${item.w}</span>
                <span class="history-yomi">${item.y}</span>
            `;
            historyList.appendChild(div);
        });
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (currentResults.length === 0) return;
            
            let text = "📖 単語ガチャで偶然の言葉と出会いました 📖\n\n";
            currentResults.forEach(item => {
                text += `『${item.w}』(${item.y})\n`;
            });
            
            text += `\n#単語ガチャ #創作支援 #語彙力\n`;
            
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank', 'width=600,height=400');
        });
    }

    if (!showRubi) {
        resultContainer.classList.add('hide-rubi');
    }

    // ==========================================
    // Phase 6: キャラクター生成（魔導書）モード
    // ==========================================
    const navGacha = document.getElementById('nav-gacha');
    const navCharacter = document.getElementById('nav-character');
    const viewGacha = document.getElementById('view-gacha');
    const viewCharacter = document.getElementById('view-character');
    const summonBook = document.getElementById('summon-book');
    const charResultCard = document.getElementById('character-result');
    const summonAgainBtn = document.getElementById('summon-again-btn');
    const mainTitle = document.getElementById('main-title');
    const rubiToggleWrapper = document.getElementById('rubi-toggle-wrapper');

    mainTitle.addEventListener('click', () => {
        navGacha.click();
    });

    navGacha.addEventListener('click', () => {
        document.body.classList.remove('theme-dark-magic');
        navCharacter.classList.remove('active');
        navGacha.classList.add('active');
        viewCharacter.style.display = 'none';
        viewGacha.style.display = 'block';
        rubiToggleWrapper.style.display = 'flex'; // ルビトグル表示
        stopFakeSummonTicker();
    });

    navCharacter.addEventListener('click', () => {
        document.body.classList.add('theme-dark-magic');
        navGacha.classList.remove('active');
        navCharacter.classList.add('active');
        viewGacha.style.display = 'none';
        viewCharacter.style.display = 'block';
        rubiToggleWrapper.style.display = 'none'; // ルビトグル非表示
        
        // Reset character result state
        charResultCard.classList.add('hidden');
        summonBook.classList.remove('open');
        summonBook.parentElement.style.display = 'flex';
        document.getElementById('char-share-btn').style.display = 'none';

        startFakeSummonTicker();
    });

    // ==========================================
    // 共通キャラクターデータ生成＆表示関数
    // ==========================================
    function generateCharacterData(db, forceSfw = false) {
        let isNsfw = false;
        let w1, w2, title1, title2, raceObj, likesObj, rsObj1, rsObj2;
        
        while (true) {
            w1 = db[Math.floor(Math.random() * db.length)];
            w2 = db[Math.floor(Math.random() * db.length)];
            title1 = db[Math.floor(Math.random() * db.length)];
            title2 = db[Math.floor(Math.random() * db.length)];
            raceObj = db[Math.floor(Math.random() * db.length)];
            likesObj = db[Math.floor(Math.random() * db.length)];
            rsObj1 = db[Math.floor(Math.random() * db.length)];
            rsObj2 = db[Math.floor(Math.random() * db.length)];
            
            const usedWords = [w1, w2, title1, title2, raceObj, likesObj, rsObj1, rsObj2];
            isNsfw = usedWords.some(w => w.c && w.c.includes('nsfw'));

            if (forceSfw && isNsfw) {
                continue; // センシティブやり直し
            } else {
                break;
            }
        }

        const charName = w1.w + w2.w;
        const charNameHtml = `<ruby>${w1.w}<rt>${w1.y}</rt></ruby><ruby>${w2.w}<rt>${w2.y}</rt></ruby>`;
        const charTitle = "【" + title1.w + "の" + title2.w + "】";
        const charRace = raceObj.w;
        const charLikes = likesObj.w;
        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(charName)}`;
        const stats = [
            { name: 'HP', val: Math.floor(Math.random() * 100) + 1 },
            { name: '攻撃', val: Math.floor(Math.random() * 100) + 1 },
            { name: '防御', val: Math.floor(Math.random() * 100) + 1 },
            { name: '素早さ', val: Math.floor(Math.random() * 100) + 1 },
            { name: rsObj1.w, val: Math.floor(Math.random() * 100) + 1 },
            { name: rsObj2.w, val: Math.floor(Math.random() * 100) + 1 }
        ];

        return { charName, charNameHtml, charTitle, charRace, charLikes, avatarUrl, stats, hasNsfw: isNsfw };
    }

    function displayCharacterCard(data) {
        document.getElementById('char-avatar-img').src = data.avatarUrl;
        document.getElementById('char-name').innerHTML = data.charNameHtml;
        document.getElementById('char-title').innerText = data.charTitle;
        document.getElementById('char-race').innerText = data.charRace;
        document.getElementById('char-likes').innerText = data.charLikes;

        const statsContainer = document.getElementById('char-stats-container');
        statsContainer.innerHTML = '';
        data.stats.forEach(st => {
            statsContainer.innerHTML += `
            <div class="stat-row">
                <span class="stat-name">${st.name}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${st.val}%;"></div>
                </div>
                <span class="stat-val">${st.val}</span>
            </div>`;
        });

        // 広告の動的表示切替
        const charAdSpace = document.getElementById('char-ad-space');
        if (charAdSpace) {
            if (data.hasNsfw) {
                charAdSpace.classList.add('hidden');
            } else {
                charAdSpace.classList.remove('hidden');
            }
        }

        summonBook.parentElement.style.display = 'none';
        charResultCard.classList.remove('hidden');
        
        const charShareBtn = document.getElementById('char-share-btn');
        if(charShareBtn) charShareBtn.style.display = 'block';
    }

    summonBook.addEventListener('click', async () => {
        if (summonBook.classList.contains('open')) return;
        summonBook.classList.add('open');

        try {
            if (!DB_CACHE['all']) {
                DB_CACHE['all'] = await loadDatabaseScript('db_all.js', 'DB_ALL');
            }
            const db = DB_CACHE['all'];
            if (!db || db.length === 0) throw new Error("Database Empty");

            // メインのガチャはセンシティブも許可する（forceSfw = false）
            const charData = generateCharacterData(db, false);

            setTimeout(() => {
                displayCharacterCard(charData);
            }, 1200);

        } catch (e) {
            console.error("エラー:", e);
            alert("データを読み込めませんでした。最新の辞書(db_all.js)を再配置してください。");
            summonBook.classList.remove('open');
        }
    });

    summonAgainBtn.addEventListener('click', () => {
        charResultCard.classList.add('hidden');
        summonBook.classList.remove('open');
        summonBook.parentElement.style.display = 'flex';
        document.getElementById('char-share-btn').style.display = 'none';
    });

    const charShareBtn = document.getElementById('char-share-btn');
    if (charShareBtn) {
        charShareBtn.addEventListener('click', () => {
            const name = document.getElementById('char-name').innerText;
            const title = document.getElementById('char-title').innerText;
            const race = document.getElementById('char-race').innerText;
            
            let text = `📖 異界辞書から新たな存在が召喚されました！\n\n`;
            text += `${title}\n`;
            text += `『${name}』\n`;
            text += `種族: ${race}\n\n`;
            text += `#単語ガチャ #魔導書ガチャ #創作キャラ\n`;
            
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank', 'width=600,height=400');
        });
    }

    // ==========================================
    // 🌍 幻影（グローバル履歴）生成ロジック
    // ==========================================
    const globalHistoryList = document.getElementById('global-history-list');

    function createFakeSummon(db) {
        // グローバル履歴もセンシティブを許可する
        const charData = generateCharacterData(db, false);

        const div = document.createElement('div');
        div.className = 'global-history-item';
        div.innerHTML = `
            <img class="gh-avatar" src="${charData.avatarUrl}" alt="avatar">
            <div class="gh-info">
                <span class="gh-title">${charData.charTitle}</span>
                <span class="gh-name">${charData.charName}</span>
                <span class="gh-meta">種族: ${charData.charRace}</span>
            </div>
        `;
        
        div.addEventListener('click', () => {
            // 一旦本が閉じた状態に戻してアニメーション（ロード）を実行
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
            charResultCard.classList.add('hidden');
            summonBook.parentElement.style.display = 'flex';
            summonBook.classList.remove('open');
            
            setTimeout(() => {
                summonBook.classList.add('open');
                
                // アニメーション実行中にグローバル履歴もまるごと新しいものに更新（リロード）
                globalHistoryList.innerHTML = '';
                for(let i=0; i<5; i++) {
                    createFakeSummon(db);
                }

                setTimeout(() => {
                    displayCharacterCard(charData);
                }, 1200);
            }, 400); // スクロール等の余裕を持たせてから開く
        });
        
        globalHistoryList.appendChild(div);
    }

    async function startFakeSummonTicker() {
        if (!DB_CACHE['all']) {
            try { 
                DB_CACHE['all'] = await loadDatabaseScript('db_all.js', 'DB_ALL'); 
            } catch(e) { return; }
        }
        
        const db = DB_CACHE['all'];
        if (!db) return;

        globalHistoryList.innerHTML = '';
        for(let i=0; i<5; i++) {
            createFakeSummon(db);
        }
    }

    function stopFakeSummonTicker() {
        // 何もしない
    }

    // Initialize default view
    navGacha.click();

});
