use anchor_lang::prelude::*;

declare_id!("7UfykF9iXWorPS7A3SvgZmJzCTCxpVEqfLyBPw4K51YH");

pub const TOPIC_LENGTH: usize = 32;

#[program]
pub mod e_voting {
    use super::*;

    pub fn create(ctx: Context<Create>, description: String) -> Result<()> {
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
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(init, payer=user, space=8 + Proposal::INIT_SPACE, seeds=[b"evoting", user.key().as_ref()], bump)]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    #[max_len(50)]
    pub description: String,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub ongoing: bool,
    pub owner: Pubkey,
}

impl Proposal {
    pub const DESCRIPTION_MAXIMUM_LENGTH: usize = 50;
}

#[error_code]
pub enum EVotingError {
    #[msg("Cannot initialize, description too long")]
    DescriptionTooLong
}