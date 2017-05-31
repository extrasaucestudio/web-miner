class FactsUI {
    constructor() {
        this._peers = document.getElementById('factPeers');
        this._blockHeight = document.getElementById('factBlockHeight');
        this._globalHashrate = document.getElementById('factGlobalHashrate');
        this._expectedHashTime = document.getElementById('factExpectedHashTime');
        this._myHashrate = document.getElementById('factMyHashrate');
        this._myBalance = document.getElementById('factBalance');
        this._blockProcessingState = document.getElementById('factBlockProcessingState');
        this._consensusProgress = document.getElementById('progress');
        this._miningSection = document.getElementById('miningSctn');
    }

    set peers(peers) {
        this._peers.textContent = peers;
    }

    set blockHeight(height) {
        this._blockHeight.textContent = height;
    }

    set myHashrate(hashrate){
        this._myHashrate.textContent = (hashrate/1000).toFixed(2);
    }

    set globalHashrate(hashrate){
        this._globalHashrate.textContent = (hashrate/1000).toFixed(2);
    }

    set expectedHashTime(expectedHashTime) {
        if (!Number.isFinite(expectedHashTime)) {
            return;
        }
        // the time is given in seconds. Convert it to an appropriate base unit:
        let timesteps = [{unit:'minutes', factor:60}, {unit:'hours', factor:60}, {unit:'days', factor:24},
            {unit:'months', factor:365/12}, {unit:'years', factor:12}, {unit:'decades', factor:10}];
        let convertedTime = expectedHashTime;
        let unit = 'seconds';
        for (var i=0; i<timesteps.length; ++i) {
            let timestep = timesteps[i];
            if (convertedTime / timestep.factor < 1) {
                break;
            } else {
                convertedTime /= timestep.factor;
                unit = timestep.unit;
            }
        }
        this._expectedHashTime.textContent = convertedTime.toFixed(1)+' '+unit;
    }

    set myBalance(balance) {
        this._myBalance.textContent = Policy.satoshisToCoins(balance).toFixed(2);
    }

    set syncing(isSyncing) {
        if (isSyncing) {
            this._blockProcessingState.textContent = "Fetching";
            this._consensusProgress.textContent = "Synchronizing";
            this._miningSection.classList.remove('synced');
            this._miningSection.offsetWidth; // force an update
            this._miningSection.classList.add('syncing');      
        } else {
            this._blockProcessingState.textContent = "Mining on";
            this._miningSection.classList.remove('syncing');
            this._miningSection.offsetWidth; // force an update
            this._miningSection.classList.add('synced');
            setTimeout(function() {
                // change the text when the _consensusProgress is faded out by the synced class
                this._consensusProgress.textContent = "Consensus Established";
            }.bind(this), 1000);
        }
    }
}

class MinerUI {
    constructor() {
        this.connBtn = document.getElementById('connBtn');
        this.facts = new FactsUI();
    }

    setState(state) {
        document.body.removeAttribute('landing')
        document.body.removeAttribute('mining')
        document.body.setAttribute(state, "")
    }
}



class NimiqMiner {
    constructor($) {
        this.ui = new MinerUI();
        this.ui.connBtn.onclick = e => this._connect($);
        this.syncing = true;
    }

    _initCore($) {
        this.$ = $;
        $.consensus.on('established', _ => this._onConsensus())
        $.consensus.on('syncing', _targetHeight => this._onSyncing(_targetHeight));
        $.blockchain.on('head-changed', _ => this._onHeadChanged());
        $.network.on('peers-changed', () => this._peersChanged());
        $.miner.on('hashrate-changed', () => this._myHashrateChanged());
        setInterval(() => this._peersChanged(), 2500);

        $.network.connect();
        this._onHeadChanged();
    }

    get hashrate() {
        return this.$.miner.hashrate;
    }

    get globalHashrate() {
        const nBits = this.$.blockchain.head.header.nBits;
        const difficulty = BlockUtils.compactToDifficulty(nBits);
        return difficulty * 2**16 / Policy.BLOCK_TIME;
    }

    _onConsensus() {
        this.$.accounts.getBalance(this.$.wallet.address)
            .then(balance => this._onBalanceChanged(balance))
        this.$.accounts.on(this.$.wallet.address, balance => this._onBalanceChanged(balance))
        this.$.miner.startWork();
        this.ui.facts.syncing = false;
        this.syncing = false;
        this._globalHashrateChanged();
    }

    _peersChanged() {
        const peers = this.$.network.peerCount;
        this.ui.facts.peers = peers;
    }

    _onSyncing(targetHeight) {
        this._targetHeight = targetHeight;
        this.ui.facts.syncing = true;
        this.syncing = true;
    }

    _onHeadChanged() {
        const height = this.$.blockchain.height;
        this.ui.facts.blockHeight = height;
        //this.setSyncProgress(height / this._targetHeight);
        if (!this.syncing) {
            this._globalHashrateChanged();
        }
    }

    _globalHashrateChanged(){
        this.ui.facts.globalHashrate = this.globalHashrate;
        this._expectedHashTimeChanged();
    }

    _myHashrateChanged(){
        this.ui.facts.myHashrate = this.hashrate;
        this._expectedHashTimeChanged();
    }

    _expectedHashTimeChanged() {
        let myWinProbability = this.hashrate / this.globalHashrate;
        this.ui.facts.expectedHashTime = (1/myWinProbability) * Policy.BLOCK_TIME;
    }

    _onBalanceChanged(balance){
        const myBalance = balance.value;
        this.ui.facts.myBalance = myBalance; 
    }

    _connect($) {
        this.ui.setState('mining');
        this._initCore($)
    }
}

Core.init($ => new NimiqMiner($));
