#!/bin/bash

source ./variables.sh

# Create a resource group if not exists
# az group create \
#       --name $resourceGroupName \
#       --location $location

########## STORAGE ACCOUNT

az storage account create \
    --location $location \
    --name $storageName \
    --resource-group $resourceGroupName \
    --sku $storageSku

# As an alternative you may use environment variables:
#   export AZURE_STORAGE_ACCOUNT=<storage_account_name>
#   export AZURE_STORAGE_ACCESS_KEY=<storage_account_key>
#   export AZURE_STORAGE_CONNECTION_STRING=<storage connection string>

storageConnectionString=$(az storage account show-connection-string \
     --name $storageName \
     --resource-group $resourceGroupName \
     --query connectionString \
     --output tsv)

az storage container create \
  --connection-string $storageConnectionString \
  --name $containerName

########## QUEUES

for queueName in ${queueNames[@]}
do
  az storage queue create \
    --connection-string $storageConnectionString \
    --name $queueName
done

########## DOCUMENTDB

az cosmosdb create \
        --name $cosmosName \
        --kind GlobalDocumentDB \
        --resource-group $resourceGroupName

_cosmosDbUri=$(az cosmosdb show -g $resourceGroupName -n $cosmosName --query documentEndpoint -o tsv)
_cosmosDbKey=$(az cosmosdb list-keys -g $resourceGroupName -n $cosmosName --query primaryMasterKey -o tsv)

az cosmosdb database create \
        --name $cosmosName \
        --db-name $databaseName \
        --resource-group $resourceGroupName

for collectionName in ${collectionNames[@]}
do
  az cosmosdb collection create \
          --collection-name $collectionName \
          --name $cosmosName \
          --db-name $databaseName \
          --resource-group $resourceGroupName
done

########## APP SERVICE PLAN

az appservice plan create \
  --name $appService \
  --resource-group $resourceGroupName \
  --sku $appServiceSku

########## FUNCTIONS

az functionapp create -g $resourceGroupName -p $appService -n $functionsName -s $storageName

########## FUNCTIONS (appsettings)

# You may choose --settings instead of --slot-settings

az webapp config appsettings set \
  --name $functionsName \
  --resource-group $resourceGroupName \
  --slot-settings "QueueStorageConnection=$storageConnectionString"

az webapp config appsettings set \
  --name $functionsName \
  --resource-group $resourceGroupName \
  --slot-settings "COSMOSDB_NAME=$databaseName"

#  Types: {ApiHub, Custom, DocDb, EventHub, MySql, NotificationHub, PostgreSQL, 
#           RedisCache, SQLAzure, SQLServer, ServiceBus}
az webapp config connection-string set \
  --connection-string-type Custom \
  --name $functionsName \
  --resource-group $resourceGroupName \
  --slot-settings "COSMOSDB_URI=$_cosmosDbUri"

az webapp config connection-string set \
  --connection-string-type Custom \
  --name $functionsName \
  --resource-group $resourceGroupName \
  --slot-settings "COSMOSDB_KEY=$_cosmosDbKey"

az webapp config connection-string set \
  --connection-string-type Custom \
  --name $functionsName \
  --resource-group $resourceGroupName \
  --slot-settings "SENDGRID_KEY=$sendGridKey"

########## FUNCTIONS (git deployment)

# az functionapp deployment user set --user-name $username --password $password

if [ -n "$gitRepoUrl" ]; then
  az functionapp deployment source config \
    --name $functionsName \
    --repo-url $gitRepoUrl \
    --branch $gitRepoBranch \
    --git-token $gitRepoToken \
    --resource-group $resourceGroupName
fi

# Configure local Git and get deployment URL
# url=$(az functionapp deployment source config-local-git --name $functionsName \
# --resource-group $resourceGroupName --query url --output tsv)

# Add the Azure remote to your local Git respository and push your code
# git remote add azure $url
# git push azure master

# When prompted for password, use the value of $password that you specified

