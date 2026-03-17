import React from 'react';
import Column from '../layout/Column';
import PoppinsText from '../ui/text/PoppinsText';
import JoinedGameListItem from './JoinedGameListItem';
const __preview_gamesTheyJoined = ['Lorem ipsum'];
const __preview_setGamesTheyJoined = () => {};
const __preview_setActiveGameId = () => {};




const JoinedGames = () => {
    return (
        <Column>
            <PoppinsText weight="bold">Joined Games</PoppinsText>

            <Column gap={0}>
                {__preview_gamesTheyJoined.map((game, index) => (
                    <JoinedGameListItem
                        key={game}
                        game={game}
                        index={index}
                        onLeave={() => {}}
                        __preview_setActiveGameId={__preview_setActiveGameId}
                    />
                ))}
            </Column>
        </Column>
    );
};

export default JoinedGames;
