import React from 'react';
import PoppinsText from '../ui/text/PoppinsText';

interface JoinedGameListItemProps {
    game: string;
    index: number;
    onLeave: () => void;
    setActiveGameId: (gameId: string) => void;
}

const JoinedGameListItem = ({ game, index, onLeave, setActiveGameId }: JoinedGameListItemProps) => {
    return (
        <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <PoppinsText weight="regular">{game}</PoppinsText>
        </div>
    );
};

export default JoinedGameListItem;
