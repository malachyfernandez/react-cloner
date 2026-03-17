import React from 'react';
import JoinedGames from './components/JoinedGames';

const App = () => {
  return (
    <div>
      <h1>My Game App</h1>
      <JoinedGames 
        gamesTheyJoined={['Game 1', 'Game 2']}
        setGamesTheyJoined={() => {}}
        setActiveGameId={() => {}}
      />
    </div>
  );
};

export default App;
