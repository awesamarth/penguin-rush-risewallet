// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title PenguinRush
 * @notice On-chain penguin jumping game on RISE Chain
 * @dev Every jump is a transaction! Contract logs jumps and tracks high scores.
 */
contract PenguinRush {
    // ============ State ============
    mapping(address => uint256) public highScores;
    mapping(address => uint256) public totalJumps;
    mapping (address=>uint256) public totalGames;
    mapping (address=>bool) public hasPlayed;
    address[] public allPlayers;


    uint256 public totalGamesPlayed;
    
    uint256 public totalJumpsRecorded;

    /**
     * @notice Record a jump - THE CORE GAME TX!
     */
    function jump() external {
        totalJumpsRecorded++;
        totalJumps[msg.sender]++;
    }

    function startGame() external{
        totalGamesPlayed++;
        totalGames[msg.sender]++;
        if (!hasPlayed[msg.sender]){
            allPlayers.push(msg.sender);
            hasPlayed[msg.sender] = true;
        }
    }

    function storeNewHighScore(uint _newHighscore) external {
        highScores[msg.sender]= _newHighscore;
    }

    // ============ View Functions ============

    function getPlayerStats(address player) external view returns (
        uint256 _totalGames,
        uint256 _totalJumps,
        uint256 _highScore
    ) {
        return (totalGames[player], totalJumps[player], highScores[player]);
    }

    function getTotalPlayers() external view returns (uint256) {
        return allPlayers.length;
    }


    function getGlobalStats() external view returns (
        uint256 _totalGames,
        uint256 _totalJumps,
        uint256 _totalPlayers
    ) {
        return (totalGamesPlayed, totalJumpsRecorded, allPlayers.length);
    }

    function getAllPlayers() external view returns (address[] memory) {
        return allPlayers;
    }
}
