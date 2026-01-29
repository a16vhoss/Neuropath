
const API_KEY = 'AIzaSyCHeNTXiq_u9JfwEYVBZbGTks6XHOkVPh4'; // Using the key found in codebase
const VIDEO_ID = 'jNQXAC9IVRw'; // "Me at the zoo" - valid video ID

async function testYouTubeAPI() {
    console.log(`Node Version: ${process.version}`);
    console.log(`Testing with Video ID: ${VIDEO_ID}`);

    // 1. Test Video Details (Tags, Duration)
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?id=${VIDEO_ID}&key=${API_KEY}&part=snippet,contentDetails,statistics`;
    try {
        const res = await fetch(detailsUrl);
        const data = await res.json();

        if (data.error) {
            console.error('API Error (Details):', JSON.stringify(data.error, null, 2));
        } else {
            const item = data.items[0];
            console.log('\n[SUCCESS] Metadata Extracted:');
            console.log('- Title:', item.snippet.title);
            console.log('- Duration:', item.contentDetails.duration);
            console.log('- Tags:', item.snippet.tags ? item.snippet.tags.slice(0, 3) : 'No tags');
            console.log('- ViewCount:', item.statistics.viewCount);
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }

    // 2. Test Comments
    const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?videoId=${VIDEO_ID}&key=${API_KEY}&part=snippet&order=relevance&maxResults=3`;
    try {
        const res = await fetch(commentsUrl);
        const data = await res.json();

        if (data.error) {
            // Comments might be disabled for this video, or key invalid
            console.error('API Error (Comments):', JSON.stringify(data.error, null, 2));
        } else {
            console.log('\n[SUCCESS] Comments Extracted:');
            if (data.items) {
                data.items.forEach(item => {
                    console.log(`- "${item.snippet.topLevelComment.snippet.textDisplay.slice(0, 50)}..."`);
                });
            } else {
                console.log('No comments found.');
            }
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}

testYouTubeAPI();
