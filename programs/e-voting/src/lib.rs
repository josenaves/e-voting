use anchor_lang::prelude::*;

declare_id!("7UfykF9iXWorPS7A3SvgZmJzCTCxpVEqfLyBPw4K51YH");

#[program]
pub mod e_voting {
    use super::*;

    pub fn create(ctx: Context<CreateProposal>, pid: u8, description: String) -> Result<()> {
        require!(
            description.as_bytes().len() <= Proposal::DESCRIPTION_MAXIMUM_LENGTH, 
            EVotingError::DescriptionTooLong
        );
    
        let proposal = &mut ctx.accounts.proposal;
        proposal.pid = pid;
        proposal.description = description;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.ongoing = true;
        proposal.owner = *ctx.accounts.user.key;

        proposal.bump = ctx.bumps.proposal;

        Ok(())
    }

    pub fn vote_yes(ctx: Context<AddVote>) -> Result<()> {
        vote(ctx, VoteType::YesVote)
    }

    pub fn vote_no(ctx: Context<AddVote>) -> Result<()> {
        vote(ctx, VoteType::NoVote)
    }
}

fn vote(ctx: Context<AddVote>, vote_type: VoteType) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    let vote = &mut ctx.accounts.vote;
    
    //  proposal must be ongoing
    require!(
        proposal.ongoing == true,
        EVotingError::VotingSessionIsClosed
    );
    
    vote.user = *ctx.accounts.user.key;
    vote.proposal = proposal.key();
    vote.bump = ctx.bumps.vote;

    match vote_type {
        VoteType::YesVote => {
            vote.vote = VoteType::YesVote;
            proposal.yes_votes = 
                proposal.yes_votes.checked_add(1).ok_or(EVotingError::MaxYesVotesReached)?;
        }
        VoteType::NoVote => {
            vote.vote = VoteType::NoVote;
            proposal.no_votes = 
                proposal.no_votes.checked_add(1).ok_or(EVotingError::MaxNoVotesReached)?;
        }
    }

    Ok(())
}

// -----------------------
// Instructions

#[derive(Accounts)]
#[instruction(pid: u8)]
pub struct CreateProposal<'info> {
    #[account(
        init, 
        payer=user, 
        space=8 + Proposal::INIT_SPACE, 
        seeds=[
            b"proposal",
            user.key().as_ref(),
            &[pid]
        ], 
        bump
    )]  
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddVote<'info> {
    #[account(
        mut,
        seeds = [
            b"proposal".as_ref(), 
            proposal.owner.as_ref(),
            &[proposal.pid]
        ], 
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(init, 
        payer = user, 
        space = 8 + Vote::INIT_SPACE,
        seeds = [
            b"vote".as_ref(), 
            proposal.key().as_ref(), 
            user.key().as_ref()
        ], 
        bump
    )]
    pub vote: Account<'info, Vote>,

    pub system_program: Program<'info, System>,
}

// ----------------------------
// State

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub pid: u8,
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