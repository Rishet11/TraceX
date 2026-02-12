const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch in Node 18+

const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

async function test() {
  try {
    console.log('1. Fetching Guest Token...');
    // 1. Get Guest Token
    const guestResp = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      }
    });

    if (!guestResp.ok) {
        console.error('Guest Token Failed:', guestResp.status, await guestResp.text());
        return;
    }

    const guestData = await guestResp.json();
    console.log('Guest Data:', guestData);
    const guestToken = guestData.guest_token;

    if (!guestToken) throw new Error('No guest token returned');

    // 2. Search
    console.log('2. Performing Search...');
    const query = 'Hello world';
    const searchUrl = `https://twitter.com/i/api/2/search/adaptive.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_has_nft_avatar=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=false&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_collab_control=true&include_ext_views=true&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&include_ext_sensitive_media_warning=true&include_ext_trusted_friends_metadata=true&send_error_codes=true&simple_quoted_tweet=true&q=${encodeURIComponent(query)}&count=20&query_source=typed_query&pc=1&spelling_corrections=1&include_ext_edit_control=true&ext=mediaStats%2ChighlightedLabel%2ChasNftAvatar%2CvoiceInfo%2Cenrichments%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Ccollab_control%2Cvibe`;

    const searchResp = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'x-guest-token': guestToken,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
        'Referer': 'https://twitter.com/'
      }
    });

    console.log('Search Status:', searchResp.status);
    
    if (!searchResp.ok) {
        console.error('Search Failed:', await searchResp.text());
        return;
    }

    const searchData = await searchResp.json();
    
    // Check if we got tweets
    if (searchData.globalObjects && searchData.globalObjects.tweets) {
       const tweetCount = Object.keys(searchData.globalObjects.tweets).length;
       console.log('Tweets found:', tweetCount);
       if (tweetCount > 0) {
           const firstTweetId = Object.keys(searchData.globalObjects.tweets)[0];
           console.log('Sample Tweet:', searchData.globalObjects.tweets[firstTweetId].full_text);
       }
    } else {
       console.log('No tweets structure found in response keys:', Object.keys(searchData));
    }

  } catch (e) {
    console.error('Error:', e);
  }
}

test();
