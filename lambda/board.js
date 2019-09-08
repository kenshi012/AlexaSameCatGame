const CARD_TYPE_1 = 0;
const CARD_TYPE_2 = 1;
const CARD_TYPE_3 = 2;
const CARD_TYPE_4 = 3;
const CARD_OPENED_MASK = 4;
const BOARD_SIZE = 8;

const NEW_BOARD = [CARD_TYPE_1,CARD_TYPE_2,CARD_TYPE_3,CARD_TYPE_4,CARD_TYPE_1,CARD_TYPE_2,CARD_TYPE_3,CARD_TYPE_4];

module.exports = class board{
    constructor () {
        this.board = Array.from(NEW_BOARD);
    }
    setNewBoard() {
        let board = Array.from(NEW_BOARD);
        let a = board.length; 
        while (a) {
            const j = Math.floor( Math.random() * a );
            const t = board[--a];
            board[a] = board[j];
            board[j] = t;
        }
        this.board = board;
    }
    getBoardSize(){
        return this.board.length;
    }

    fromString(inputStr){
        let inputtVal = parseInt(inputStr, 10);
        let tmpVal = inputtVal;
        let boardTmp = [];
        let i = 0;
        for(i = 0; i < this.board.length; i++){
            boardTmp[i] = inputtVal % 10;
            inputtVal = parseInt(inputtVal /10, 10);
        }
        this.board = boardTmp.reverse();
    }
    toString(){
        let val = "";
        let i = 0;
        for( i = 0; i < this.board.length; i++ ){
            val += this.board[i];
        }
        return val;
    }
    getItemType(pos){
        return (this.board[pos] >= CARD_OPENED_MASK) ? (this.board[pos] - CARD_OPENED_MASK) : this.board[pos];
    }
    isOpened(pos){
        return (this.board[pos] >= CARD_OPENED_MASK);
    }
    canOpen(pos){
        return !this.isOpened(pos) 
    }
    openCards(pos1, pos2){
        const res = (this.board[pos1] === this.board[pos2]);
        if(res){
            this.board[pos1] = this.board[pos1] + CARD_OPENED_MASK;
            this.board[pos2] = this.board[pos1];
        }
        return res
    }
    isFullOpened(){
        const reducer = (accumulator, currentValue) => accumulator + currentValue;
        const cur_sum = this.board.reduce(reducer);

        let tmpboard = Array.from(NEW_BOARD);
        const new_sum = tmpboard.reduce(reducer);

        return (cur_sum === (CARD_OPENED_MASK * this.board.length + new_sum));
    }
 
}

module.exports.CARD_TYPE_1 = CARD_TYPE_1;
module.exports.CARD_TYPE_2 = CARD_TYPE_2;
module.exports.CARD_TYPE_3 = CARD_TYPE_3;
module.exports.CARD_TYPE_4 = CARD_TYPE_4;
module.exports.CARD_OPENED_MASK = CARD_OPENED_MASK;
