use anchor_lang::prelude::*;

declare_id!("7UfykF9iXWorPS7A3SvgZmJzCTCxpVEqfLyBPw4K51YH");

pub const PROPOSAL_SEED : &str= "evoting_proposal_seed";
pub const VOTE_SEED : &str= "evoting_vote_seed";

#[program]
pub mod e_voting {
    use super::*;

    pub fn create(ctx: Context<CreateProposal>, description: String) -> Result<()> {
        require!(
            description.as_bytes().len() <= Proposal::DESCRIPTION_MAXIMUM_LENGTH, 
            EVotingError::DescriptionTooLong
        );
    
        let proposal = &mut ctx.accounts.proposal;
        proposal.description = description;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.ongoing = true;
        proposal.owner = *ctx.accounts.user.key;

        proposal.bump = ctx.bumps.proposal;

        Ok(())
    }

    pub fn vote_yes(ctx: Context<AddVote>, description: String) -> Result<()> {
        vote(ctx, VoteType::YesVote, description)
    }

    pub fn vote_no(ctx: Context<AddVote>, description: String) -> Result<()> {
        vote(ctx, VoteType::NoVote, description)
    }
}

fn vote(ctx: Context<AddVote>, vote_type: VoteType, description: String) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    let vote = &mut ctx.accounts.vote;
    
    msg!("proposal: {}", proposal.key());
    msg!("vote: {}", vote.key());

    //  proposal must be ongoing
    require!(
        proposal.ongoing == true,
        EVotingError::VotingSessionIsClosed
    );
    
    // vote.user = ctx.accounts.user.key();
    vote.user = *ctx.accounts.user.key;
    vote.proposal = proposal.key();
    vote.bump = ctx.bumps.vote;
    vote.description = description;

    match vote_type {
        VoteType::YesVote => {
            proposal.yes_votes = proposal.yes_votes.checked_add(1).ok_or(EVotingError::MaxYesVotesReached)?;
            vote.vote = VoteType::YesVote;
        }
        VoteType::NoVote => {
            proposal.no_votes = proposal.no_votes.checked_add(1).ok_or(EVotingError::MaxNoVotesReached)?;
            vote.vote = VoteType::NoVote;
        }
    }

    Ok(())
}

// -----------------------
// Instructions

#[derive(Accounts)]
#[instruction(description: String)]
pub struct CreateProposal<'info> {
    #[account(
        init, 
        payer=user, 
        space=8 + Proposal::INIT_SPACE, 
        seeds=[
            description.as_bytes(),
            PROPOSAL_SEED.as_bytes(),
            user.key().as_ref(),
        ], 
        bump
    )]  
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(description: String)]
pub struct AddVote<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + Vote::INIT_SPACE,
        seeds = [
            VOTE_SEED.as_bytes(), 
            user.key().as_ref(),
            proposal.key().as_ref(),
        ], 
        bump
    )]
    pub vote: Account<'info, Vote>,
    #[account(
        mut,
        seeds = [
            description.as_bytes(),
            PROPOSAL_SEED.as_bytes(),
            user.key().as_ref(),
        ],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

// ----------------------------
// State

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    #[max_len(50)]
    pub description: String,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub ongoing: bool,
    pub owner: Pubkey,
    pub bump: u8,
}

impl Proposal {
    pub const DESCRIPTION_MAXIMUM_LENGTH: usize = 50;
}

#[account]
#[derive(InitSpace)]
pub struct Vote {
    pub user: Pubkey,
    pub proposal: Pubkey,
    pub vote: VoteType,
    #[max_len(50)]
    pub description: String,
    pub bump: u8,
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone, InitSpace)]
pub enum VoteType {
    YesVote,
    NoVote
}

#[error_code]
pub enum EVotingError {
    #[msg("Cannot initialize, description too long")]
    DescriptionTooLong,
    #[msg("Voting session is closed")]
    VotingSessionIsClosed,
    #[msg("You can just submit one vote per proposal")]
    DuplicatedVoteNotAllowed,
    #[msg("Maximum number of yes votes reached")]
    MaxYesVotesReached,
    #[msg("Maximum number of no votes reached")]
    MaxNoVotesReached,
}