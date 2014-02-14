# Script to analyse disease burden and MP sexiness
# 140214
# By Gustav Nilsonne, free to use
# Works in R version 3.0.1

# Read data
# Change search path as appropriate if running on a different computer
dataDeaths <- read.csv("C:/Users/FIXITx64_ENG/Dropbox/Gustavs_arbete/Pek/PoliticiansSelfRatedHealth/sexymp-data-20140207/mp_with_deaths_and_rates.csv", header=T, skip = 1)
dataLifeExp <- read.csv("C:/Users/FIXITx64_ENG/Dropbox/Gustavs_arbete/Pek/PoliticiansSelfRatedHealth/sexymp-data-20140207/mp_with_life_expectancy.csv", header=T, skip = 1)
dataHealth <- read.csv2("C:/Users/FIXITx64_ENG/Dropbox/Gustavs_arbete/Pek/PoliticiansSelfRatedHealth/SRH.csv", header = T)

# Merge data
data_merged <- merge(dataDeaths, dataLifeExp, by = "constituency")
data_merged <- merge(data_merged, dataHealth, by.x = "constituency", by.y = "parliamentary.constituency.2010")

# Inspect distributions of variables
hist(data_merged$deaths_rate_infant)
hist(data_merged$life_exp_birth_male_years)
hist(data_merged$life_exp_birth_female_years)
hist(data_merged$won.x)
summary(data_merged$won.x + data_merged$lost.x)

# Generate new variables for analysis and inspect their distributions
data_merged$deaths_rate_infant_zscore <- (data_merged$deaths_rate_infant - mean(data_merged$deaths_rate_infant))/sd(data_merged$deaths_rate_infant)
hist(data_merged$deaths_rate_infant_zscore)

data_merged$SRH_score = (data_merged[, 55]*5 + data_merged[, 56]*4 + data_merged[, 57]*3 + data_merged[, 58]*2 + data_merged[, 59]*1)/data_merged[, 54]
hist(data_merged$SRH_score)

data_merged$life_exp_birth <- (data_merged$life_exp_birth_male_years + data_merged$life_exp_birth_female_years)/2

# Check whether life expectancy and infant mortality are correlated
plot(life_exp_birth ~ deaths_rate_infant, data = data_merged)
cor.test(data_merged$life_exp_birth, data_merged$deaths_rate_infant)

# Create a score based on fraction of wins
data_merged$Score <- data_merged$won.x/(data_merged$won.x + data_merged$lost.x)

# Perform analyses (export plots manually to pdf from RStudio at 6x6 inches)
# For purposes of plotting, create a null model with party and sex as predictors
lm_party <- lm(Score ~ party.x + gender.x, data = data_merged)

# First infant  mortality
plot(lm_party$residuals ~ data_merged$deaths_rate_infant, 
     xlab = "Infant Mortality (per 1000 live births)", ylab = "sexymp.co.uk score, residual")
points(lm_party$residuals[data_merged$gender.x == "F"] ~ data_merged$deaths_rate_infant[data_merged$gender.x == "F"], pch = 16)
lm_inf <- lm(lm_party$residuals ~ data_merged$deaths_rate_infant)
lines(c(min(data_merged$deaths_rate_infant), max(data_merged$deaths_rate_infant)), c(min(predict(lm_inf)), max(predict(lm_inf))), col = "red")
lines(loess.smooth(data_merged$deaths_rate_infant, lm_party$residuals), col = "blue")
lm_inf2 <- lm(lm_party$residuals ~ data_merged$deaths_rate_infant + data_merged$party.x + data_merged$gender.x)
summary(lm_inf2)
confint(lm_inf2, )

# Then life expectancy
plot(lm_party$residuals ~ data_merged$life_exp_birth, 
     xlab = "Life Expectancy at Birth (years)", ylab = "sexymp.co.uk score, residual")
points(lm_party$residuals[data_merged$gender.x == "F"] ~ data_merged$life_exp_birth[data_merged$gender.x == "F"], pch = 16)
lm_life <- lm(lm_party$residuals ~ data_merged$life_exp_birth)
lines(c(min(data_merged$life_exp_birth), max(data_merged$life_exp_birth)), c(min(predict(lm_life)), max(predict(lm_life))), col = "red")
lines(loess.smooth(data_merged$life_exp_birth, lm_party$residuals), col = "blue")
lm_life2 <- lm(lm_party$residuals ~ data_merged$life_exp_birth + data_merged$party.x + data_merged$gender.x)
summary(lm_life2)
confint(lm_life2, )

# Then self-rated health
plot(lm_party$residuals ~ data_merged$SRH_score, 
     xlab = "Self-Rated Health", ylab = "sexymp.co.uk score, residual")
points(lm_party$residuals[data_merged$gender.x == "F"] ~ data_merged$SRH_score[data_merged$gender.x == "F"], pch = 16)
lm_SRH <- lm(lm_party$residuals ~ data_merged$SRH_score)
lines(c(min(data_merged$SRH_score), max(data_merged$SRH_score)), c(min(predict(lm_SRH)), max(predict(lm_SRH))), col = "red")
lines(loess.smooth(data_merged$SRH_score, lm_party$residuals), col = "blue")
lm_SRH2 <- lm(lm_party$residuals ~ data_merged$SRH_score + data_merged$party.x + data_merged$gender.x)
summary(lm_SRH2)
confint(lm_SRH2, )

# Analyse lowest-health constituencies separately, following White et al. 2013
sexiness <- lm_party$residuals[data_merged$deaths_rate_infant > mean(data_merged$deaths_rate_infant)+sd(data_merged$deaths_rate_infant)]
inf_mortality <- data_merged$deaths_rate_infant[data_merged$deaths_rate_infant > mean(data_merged$deaths_rate_infant)+sd(data_merged$deaths_rate_infant)]
party <- data_merged$party.x[data_merged$deaths_rate_infant > mean(data_merged$deaths_rate_infant)+sd(data_merged$deaths_rate_infant)]
sex <- data_merged$gender.x[data_merged$deaths_rate_infant > mean(data_merged$deaths_rate_infant)+sd(data_merged$deaths_rate_infant)]
lm_inf3 <- lm(sexiness ~ inf_mortality + party + sex)
summary(lm_inf3)

sexiness <- lm_party$residuals[data_merged$life_exp_birth < mean(data_merged$life_exp_birth)-sd(data_merged$life_exp_birth)]
inf_mortality <- data_merged$life_exp_birth[data_merged$life_exp_birth < mean(data_merged$life_exp_birth)-sd(data_merged$life_exp_birth)]
party <- data_merged$party.x[data_merged$life_exp_birth < mean(data_merged$life_exp_birth)-sd(data_merged$life_exp_birth)]
sex <- data_merged$gender.x[data_merged$life_exp_birth < mean(data_merged$life_exp_birth)-sd(data_merged$life_exp_birth)]
lm_life3 <- lm(sexiness ~ inf_mortality + party + sex)
summary(lm_life3)

sexiness <- lm_party$residuals[data_merged$SRH_score < mean(data_merged$SRH_score)-sd(data_merged$SRH_score)]
inf_mortality <- data_merged$SRH_score[data_merged$SRH_score < mean(data_merged$SRH_score)-sd(data_merged$SRH_score)]
party <- data_merged$party.x[data_merged$SRH_score < mean(data_merged$SRH_score)-sd(data_merged$SRH_score)]
sex <- data_merged$gender.x[data_merged$SRH_score < mean(data_merged$SRH_score)-sd(data_merged$SRH_score)]
lm_SRH3 <- lm(sexiness ~ inf_mortality + party + sex)
summary(lm_SRH3)
