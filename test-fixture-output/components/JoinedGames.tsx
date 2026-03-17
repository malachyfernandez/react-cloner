import React from 'react';
import Column from '../layout/Column';
import PoppinsText from '../ui/text/PoppinsText';
import JoinedGameListItem from './JoinedGameListItem';

interface JoinedGamesProps {
    gamesTheyJoined: string[];
    setGamesTheyJoined: (games: string[]) => void;
    setActiveGameId: (gameId: string) => void;
}

const JoinedGames = ({ gamesTheyJoined, setGamesTheyJoined, setActiveGameId }: JoinedGamesProps) => {
    return (
        <Column>
            <PoppinsText weight="bold">Joined Games</PoppinsText>

            <Column gap={0}>
                {gamesTheyJoined.map((game, index) => (
                    <JoinedGameListItem
                        key={game}
                        game={game}
                        index={index}
                        onLeave={() =>
                            setGamesTheyJoined(
                                gamesTheyJoined.filter((g) => g !== game)
                            )
                        }
                        setActiveGameId={setActiveGameId}
                    />
                ))}
            </Column>
        </Column>
    );
};

export default JoinedGames;
