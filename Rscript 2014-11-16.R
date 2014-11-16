# Script to analyse disease burden and MP sexiness
# 2014-11-16
# By Gustav Nilsonne, free to use
# Works in R version 3.0.1

# Require packages
library(RCurl) # To read data from GitHub

# Read data
mp_with_life_expectancy <- getURL("https://raw.githubusercontent.com/tgwizard/sexymp-data/master/data/processed/mp_with_life_expectancy.csv", ssl.verifypeer = FALSE)
dataLifeExp <- read.csv(text = mp_with_life_expectancy, skip = 1)

nomis_2014_11_16_150610 <- getURL("https://raw.githubusercontent.com/tgwizard/sexymp-data/master/nomis_2014_11_16_150610.csv", ssl.verifypeer = FALSE)
dataHealth <- read.csv2(text = nomis_2014_11_16_150610, header = T, skip = 8, nrows = 574)

mp_with_deaths_and_rates <- getURL("https://raw.githubusercontent.com/tgwizard/sexymp-data/master/data/processed/mp_with_deaths_and_rates.csv", ssl.verifypeer = FALSE)
dataDeaths <- read.csv(text = mp_with_deaths_and_rates, skip = 1)
ManMergedDataInfMort140806_url <- getURL("https://raw.githubusercontent.com/tgwizard/sexymp-data/master/ManMergedDataInfMort140806.csv", ssl.verifypeer = FALSE)
ManMergedDataInfMort140806_data <- read.csv2(text = ManMergedDataInfMort140806_url)
ManMergedDataInfMort140806_data[, 4:6] <- ManMergedDataInfMort140806_data[, 4:6]*1000 #Go to raw population sizes

dataDeaths <- merge(dataDeaths, ManMergedDataInfMort140806_data, by = c("population_total", "population_male", "population_female", "deaths_num_total", "deaths_num_male", "deaths_num_female", "deaths_num_infant", "deaths_num_neonatal", "deaths_rate_crude", "deaths_rate_agestd_total", "deaths_rate_agestd_male", "deaths_rate_agestd_female"))
length(unique(as.character(dataDeaths$name))) # Verify that merge operation succeeded without duplicates
dataDeaths$InfMort <- rowMeans(data.frame(dataDeaths$InfMort2010, dataDeaths$InfMort2011, dataDeaths$InfMort2012), na.rm = TRUE)

# Merge data
data_merged <- merge(dataDeaths, dataLifeExp, by = "constituency")
data_merged <- merge(data_merged, dataHealth, by.x = "constituency", by.y = "parliamentary.constituency.2010")

# Inspect distributions of variables
hist(data_merged$deaths_rate_infant, main = "Infant mortality", xlab = "Deaths per 1000 births")
hist(data_merged$life_exp_birth_male_years, main = "Life expectancy, men", xlab = "Years")
hist(data_merged$life_exp_birth_female_years, main = "Life expectancy, women", xlab = "Years")
hist(data_merged$won.x, main = "Number of wins in sexymp.com ratings", xlab = "n")
summary(data_merged$won.x + data_merged$lost.x)

# Generate new variables for analysis and inspect their distributions
#data_merged$deaths_rate_infant_zscore <- scale(data_merged$deaths_rate_infant)
#hist(data_merged$deaths_rate_infant_zscore, main = "Infant mortality", xlab = "z-score")

data_merged$SRH_score = (data_merged$Very.good.health*5 + data_merged$Good.health*4 + data_merged$Fair.health*3 + data_merged$Bad.health*2 + data_merged$Very.bad.health*1)/data_merged$All.categories..General.health
hist(data_merged$SRH_score, main = "Self-rated health", xlab = "Mean rating for constituency")

data_merged$life_exp_birth <- (data_merged$life_exp_birth_male_years + data_merged$life_exp_birth_female_years)/2

# Check whether life expectancy and infant mortality are correlated
plot(life_exp_birth ~ InfMort, data = data_merged)
cor.test(data_merged$life_exp_birth, data_merged$InfMort)

# Create a score based on fraction of wins
data_merged$Score <- data_merged$won.x/(data_merged$won.x + data_merged$lost.x)

# Perform analyses (export plots manually to pdf from RStudio at 6x6 inches)
# For purposes of plotting, create a null model with party and sex as predictors
lm_party <- lm(Score ~ party.x + gender.x, data = data_merged)
par(mar = c(5.1, 4.1, 2, 0)) # Set margins for plotting
    
# First infant  mortality
plot(lm_party$residuals ~ data_merged$InfMort, 
     xlab = "Infant mortality per 1000 live births", ylab = "sexymp.co.uk score, residual", frame.plot = F)
points(lm_party$residuals[data_merged$gender.x == "F"] ~ data_merged$InfMort[data_merged$gender.x == "F"], pch = 16)
lm_inf <- lm(lm_party$residuals ~ data_merged$InfMort)
lines(c(min(data_merged$InfMort, na.rm = T), max(data_merged$InfMort, na.rm = T)), c(max(predict(lm_inf)), min(predict(lm_inf))), col = "red")
lines(loess.smooth(data_merged$InfMort, lm_party$residuals), col = "blue")
lm_inf2 <- lm(Score ~ InfMort + party.x + gender.x, data = data_merged)
summary(lm_inf2)
confint(lm_inf2, )

# Then life expectancy
plot(lm_party$residuals ~ data_merged$life_exp_birth, 
     xlab = "Life Expectancy at Birth (years)", ylab = "sexymp.co.uk score, residual", frame.plot = F)
points(lm_party$residuals[data_merged$gender.x == "F"] ~ data_merged$life_exp_birth[data_merged$gender.x == "F"], pch = 16)
lm_life <- lm(lm_party$residuals ~ data_merged$life_exp_birth)
lines(c(min(data_merged$life_exp_birth), max(data_merged$life_exp_birth)), c(max(predict(lm_life)), min(predict(lm_life))), col = "red")
lines(loess.smooth(data_merged$life_exp_birth, lm_party$residuals), col = "blue")
lm_life2 <- lm(Score ~ life_exp_birth + party.x + gender.x, data = data_merged)
summary(lm_life2)
confint(lm_life2, )

# Then self-rated health
plot(lm_party$residuals ~ data_merged$SRH_score, 
     xlab = "Self-Rated Health", ylab = "sexymp.co.uk score, residual", frame.plot = F)
points(lm_party$residuals[data_merged$gender.x == "F"] ~ data_merged$SRH_score[data_merged$gender.x == "F"], pch = 16)
lm_SRH <- lm(lm_party$residuals ~ data_merged$SRH_score)
lines(c(min(data_merged$SRH_score), max(data_merged$SRH_score)), c(min(predict(lm_SRH)), max(predict(lm_SRH))), col = "red")
lines(loess.smooth(data_merged$SRH_score, lm_party$residuals), col = "blue")
lm_SRH2 <- lm(Score ~ SRH_score + party.x + gender.x, data = data_merged)
summary(lm_SRH2)
confint(lm_SRH2, )

# Analyse lowest-health constituencies separately, following White et al. 2013
lm_inf3 <- lm(Score ~ InfMort + party.x + gender.x, data = data_merged[data_merged$InfMort > mean(data_merged$InfMort, na.rm = T) + sd(data_merged$InfMort, na.rm = T), ])
summary(lm_inf3)
confint(lm_inf3, )

lm_life3 <- lm(Score ~ life_exp_birth + party.x + gender.x, data = data_merged[data_merged$life_exp_birth < mean(data_merged$life_exp_birth) - sd(data_merged$life_exp_birth), ])
summary(lm_life3)
confint(lm_life3, )

lm_SRH2 <- lm(Score ~ SRH_score + party.x + gender.x, data = data_merged[data_merged$SRH_score < mean(data_merged$SRH_score) - sd(data_merged$SRH_score), ])
summary(lm_SRH2)
confint(lm_SRH2, )