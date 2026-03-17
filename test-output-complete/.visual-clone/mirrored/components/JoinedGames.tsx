import React from 'react';
import "Lorem ipsum" from 'react-native';

const __preview_gamesTheyJoined = ['Lorem ipsum'];
const __preview_setGamesTheyJoined = () => {};
const __preview_setActiveGameId = () => {};




const JoinedGames = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Joined Games</Text>

            <View style={styles.list}>
                {__preview_gamesTheyJoined.map((game, index) => (
                    <View key={game} style={styles.gameItem}>
                        <Text style={styles.gameName}>{game}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: "Lorem ipsum",
    title: "Lorem ipsum",
    list: "Lorem ipsum",
    gameItem: "Lorem ipsum",
    gameName: "Lorem ipsum"
});

export default JoinedGames;
