import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface JoinedGamesProps {
    gamesTheyJoined: string[];
    setGamesTheyJoined: (games: string[]) => void;
    setActiveGameId: (gameId: string) => void;
}

const JoinedGames = ({ gamesTheyJoined, setGamesTheyJoined, setActiveGameId }: JoinedGamesProps) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Joined Games</Text>

            <View style={styles.list}>
                {gamesTheyJoined.map((game, index) => (
                    <View key={game} style={styles.gameItem}>
                        <Text style={styles.gameName}>{game}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    list: {
        gap: 8,
    },
    gameItem: {
        padding: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    gameName: {
        fontSize: 16,
    }
});

export default JoinedGames;
