I have a social mining thing for Qoneqt.com where all the interactions i have to validate and incentivize upon them 

--- I have a Ai for validation of those interactions which would be like this 
 ```
 # Scoring Project

## Initial features

1) Post Content -- Points -- 30 per/month and only 2 post will be considered .. per post 0.5 point
2) Likes -- Points -- 5 Likes per day 0.1 per like -- 15 points mothly
3) Comment -- Points -- 5 Comments per day 0.1 per com --  15 points monthly
4) Referrals -- Points -- 10 /month --  after verfication only 
5) Tipping ( fiat & crypto ) -- points  20 points   
6) Verification --  10 (one time )
7) Token Generation ( basically my own currency )  -- points --  10  
8) Registration --  10 (one time )
9) Weekly leaderboards --- Points  on comming top --  3 points // to be seen
10) Montly Leaderboards -- Points  on comming top --  3 points // to be seen

## Notes
1) As the user posts the time will be noted and a 24 hour period will be counted and as the 2 posts are done, it will hit a cool down period to not take further posts as points
2) per day max likes to take into account is 5 and same with comments 5 only. 


## Task 

1) Duplicate Content Detection
2) Avoid Giberrish content
3) avoid rewriting and plagarism -- creation of vector db or some



## Constants

1) Per user will be graded between 0 to 100 points not more than that strict rule
2) Above conditions are true for eg 5 likes 5 comments 2 post there are only to be considered 


## Idea of the project

Based on the score the user will be given tokes (money) and out ai should intelligently analize the whole features and give points as output,

--> chekcing for plagarism form the vector db or any efficient data storage
--> check for other checks 
--> if passed then working on scoring






## 17 - Jul 

--> implement the per day rules and motnly caps 
--> comments gibberish  check 
--> implement cool down for the posts per day only 2


### Phase 1: The Vision & Core Concepts

The goal is to implement a new, daily background process that evaluates user "consistency." This addresses the scenario where a valuable user might not meet the daily interaction criteria but has a strong history of engagement.

**Key Concepts:**

1.  **Historical Engagement Score:** We will create a new metric, the `HistoricalEngagementScore`, distinct from the monthly 0-100 score. This new score will be calculated based on a user's long-term activity patterns.
2.  **Activity Streak:** We will track the number of consecutive days a user has interacted with the platform. A longer streak signifies a more consistent user.
3.  **Overall Activeness:** We will quantify a user's total contribution, looking at the volume and quality of their past interactions.
4.  **Daily Scheduled Job:** Instead of running this logic on-demand, we will use a scheduler (**Celery Beat**) to trigger a task automatically every 24 hours. This task will analyze all users.
5.  **Identifying Top Consistent Users:** After calculating the `HistoricalEngagementScore` for users who were inactive in the last 24 hours, the system will identify a configurable number (e.g., top 5) of these users, who could then be eligible for special rewards or recognition.

This approach keeps the new logic separate from the real-time scoring system, ensuring the API remains fast and responsive while adding a deeper layer of user analysis.

---

### Phase 2: Architecture & New Components

To build this in a modular and scalable way, we will introduce a few new components and update existing ones.

#### 1. Scheduler: `Celery Beat`
The `README.md` already lists a scheduled job as a future improvement. Now is the time to implement it.
*   **What it is:** Celery Beat is a scheduler that kicks off tasks at regular intervals. It integrates perfectly with our existing Celery and Redis setup.
*   **How we'll use it:** We will configure Celery Beat to run a new "user analysis" task once every 24 hours.

#### 2. New Logic Module: `core/historical_analyzer.py`
This will be a new file to house all the logic for the historical analysis. This maintains our Service-Oriented Architecture and keeps the `scoring_engine.py` focused on immediate, transactional point calculations.

The `HistoricalAnalyzer` class inside this file will be responsible for:
*   Connecting to the database.
*   Fetching all users and their relevant interaction data.
*   Determining which users were active in the last 24 hours.
*   **For active users:** Incrementing their `consecutive_activity_days` (streak).
*   **For inactive users:**
    *   Resetting their streak to 0.
    *   Calculating their `HistoricalEngagementScore` based on their history (total posts, average post quality, etc.).
*   Updating all user records in the database with the new streak and score information in a single, efficient transaction per user.

#### 3. New Scheduled Task in `celery_worker.py`
We will define a new task in our existing `celery_worker.py` file.

*   `evaluate_user_consistency_task()`: This Celery task will be triggered by Celery Beat. Its only job is to instantiate the `HistoricalAnalyzer` and call the main analysis method.

#### 4. New Configuration in `scoring_config.py`
To keep the system flexible and future-proof, all new "magic numbers" will be added to the configuration file.

*   `TOP_INACTIVE_USERS_TO_REWARD`: The number of top inactive users to identify (e.g., `5`).
*   `HISTORICAL_SCORE_WEIGHTS`: A dictionary containing the weights for different factors when calculating the `HistoricalEngagementScore` (e.g., `{'streak': 0.4, 'total_posts': 0.3, 'avg_quality': 0.3}`).



# Logic

1.  **Criteria Met Users:**
    *   **Who they are:** Users who successfully completed all daily limits (e.g., 2 posts AND 5 likes AND 5 comments).
    *   **What they get:** They have already received their standard rewards (crypto, etc.) via the real-time API calls.
    *   **Streak:** Their activity streak is maintained and incremented.
    *   **Historical Score:** Their `historical_engagement_score` for the day is set to **0**. They are not eligible for the "empathy" reward because they were fully active and rewarded.

2.  **Criteria NOT Met Users:**
    *   **Who they are:** *Everyone else*. This includes users who were partially active (1 like, 0 posts) and users who had **zero activity** all day.
    *   **What happens to them:**
        *   **Streak:** Their `consecutive_activity_days` streak is **reset to 0**. This is the trade-off: failing to meet the full criteria breaks the streak.
        *   **Historical Score:** A new `historical_engagement_score` is calculated for them. This calculation heavily values the `streak` they had *before* it was reset, plus their lifetime contributions.
    *   **The Reward:** The entire pool of "Criteria NOT Met Users" is then sorted by this new `historical_engagement_score`, and the top N users are identified as candidates for the empathy reward.


```

and now on the contracts side we have to store these interactions in incremental merkle trees in which all the addresses who have completed the required interactions for the day all the addresses would be hashed in leaves / arrays and those arrays are getting stored in the leaves / hashes in the incremental merkle trees and for viewing their presence we would have a public verify function which will check the participation of that address and will return true / false to confirm their participation three funcrions only on for inserting them and one view function which will take that arrayVerify(uint256 array[] , hash ) and will pass it to the verify function which will check if that address is present inside the hash or not and if not lets say then other array would also be there like A[0] -> hash , A[1] --> hash , A[2] --> hash like this and it verify function would  return true / false 


for now i have this way of implementing the above problem 
```
 [0] -> hash 

 generateHash () --? 

 ---> dateWise ? 
 merkleArrays ( A , address ) view for A[0] --> n 
 verifyHash(A[0] , address ) --> true / false 
 ```

Merkle trees on basis of date and type of interactions 

on each day new merkle trees would be initiated w/ that days transactions in its leaf nodes and a root would be calculated after which it should be mapped with block.timestamp for that day's merkle root for each interactions which are            { Create1
Likes2
Comments3
Tipping( Crypto / Fiat )4
Crypto Interactions5
Referrals6
}


```
There would be two contracts -
   - 1 MerkleTree --> A simple merkle tree implementation w/ depth 2^20
   - 2 MerkleGeneratorVerifier --> would have 6 instances for each interactions mapped with block.timestamp in which each 24 hours validated addresses would be pushed to create a merkle root hash and would have three main functions like generate , verify, participation view function 
   - 3 each and everyday new merkle tree for each type of interaction would be generated and which can be viewed using a event emitted naming block.timestamp , merkle root hash
- ````